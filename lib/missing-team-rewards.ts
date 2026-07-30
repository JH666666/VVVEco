/**
 * 团队奖励链上补录。
 * 扫描链上 TeamRewardAccrued 事件，把数据库 team_rewards 表缺失的记录补回。
 * 团队奖励由下级领取时自动打到上级钱包，DB 记录由下级浏览器写入（best-effort），
 * 一旦写库失败，链上已发放但 DB 缺记录 —— 本模块负责补回。
 *
 * 所有数据来自链上，不猜测金额。
 */
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { prisma } from "@/lib/prisma";

const STAKING_ADDR = (
  process.env.NEXT_PUBLIC_VVECO_STAKING ?? "0x5ec768D99Cdc49a95E29811Ce97a313f294EBC64"
) as `0x${string}`;

const DEPLOY_BLOCK = 47_526_639n;
const LOG_CHUNK = 2000n;
const RPC_URL = process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org";

const client = createPublicClient({
  chain: base,
  transport: http(RPC_URL, { retryCount: 2, retryDelay: 600 }),
});

// 链上实际 topic0（与前端/诊断脚本一致），用原生 eth_getLogs 过滤，避免 ABI 推导偏差
const TEAM_REWARD_TOPIC =
  "0xe07f61c526a4ace6d1e5cad0a84eddbf8e2733ce8383b0b2f1d76f07fb1cab49";

interface RawLog {
  topics: string[];
  data: string;
  transactionHash: string;
  blockNumber: string;
  logIndex: string;
}

export interface MissingTeamReward {
  txHash: string;
  logIndex: number;
  claimTxHash: string; // `${txHash}_${logIndex}`
  beneficiaryAddr: string; // 上级 recipient
  sourceAddr: string; // 下级 claimer
  amount: number; // VVV
  blockNumber: number;
}

/**
 * 分组键：base txHash + 上级 + 下级（忽略 claimTxHash 的 _logIndex 后缀差异）。
 * 注意：同一交易里，同一上级可能因多笔订单/多代收到多笔奖励，所以按"笔数"补，
 * 不能只按 (交易|上级|下级) 判存在，否则会漏补。
 */
function groupKey(baseTx: string, beneficiary: string, source: string) {
  return `${baseTx.toLowerCase()}|${beneficiary.toLowerCase()}|${source.toLowerCase()}`;
}

/**
 * 给定候选事件 + DB 已有记录，按分组"笔数差"计算真正缺失的事件。
 * 每组：链上笔数 N，DB 已有 M，缺失 = N - M（取尚未精确匹配的事件补齐）。
 */
function computeMissingByCount(
  candidates: MissingTeamReward[],
  existing: Array<{ claimTxHash: string; beneficiaryAddr: string; sourceAddr: string }>
): MissingTeamReward[] {
  const existingCountByGroup = new Map<string, number>();
  const existingExact = new Set<string>();
  for (const e of existing) {
    const base = e.claimTxHash.split("_")[0];
    existingCountByGroup.set(
      groupKey(base, e.beneficiaryAddr, e.sourceAddr),
      (existingCountByGroup.get(groupKey(base, e.beneficiaryAddr, e.sourceAddr)) ?? 0) + 1
    );
    existingExact.add(e.claimTxHash.toLowerCase());
  }

  const byGroup = new Map<string, MissingTeamReward[]>();
  for (const c of candidates) {
    const g = groupKey(c.txHash, c.beneficiaryAddr, c.sourceAddr);
    const arr = byGroup.get(g);
    if (arr) arr.push(c);
    else byGroup.set(g, [c]);
  }

  const missing: MissingTeamReward[] = [];
  for (const [g, evs] of byGroup) {
    const dbCount = existingCountByGroup.get(g) ?? 0;
    const need = evs.length - dbCount;
    if (need <= 0) continue;
    // 优先补那些精确 claimTxHash 尚未入库的事件
    const notExact = evs.filter((e) => !existingExact.has(e.claimTxHash.toLowerCase()));
    missing.push(...notExact.slice(0, need));
  }
  return missing;
}

/** 扫描指定区块区间 [fromBlock, toBlock] 内的 TeamRewardAccrued 事件，返回 DB 中缺失的记录。 */
export async function scanMissingTeamRewardsRange(
  fromBlock: bigint,
  toBlock: bigint
): Promise<MissingTeamReward[]> {
  if (fromBlock > toBlock) return [];

  // 用原生 eth_getLogs + 写死的 topic 过滤（与前端/诊断脚本一致），分段抓取
  const allLogs: RawLog[] = [];
  let succeeded = 0;
  let failed = 0;
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n > toBlock ? toBlock : start + LOG_CHUNK - 1n;
    try {
      const chunk = (await client.request({
        method: "eth_getLogs",
        params: [
          {
            address: STAKING_ADDR,
            topics: [TEAM_REWARD_TOPIC],
            fromBlock: `0x${start.toString(16)}`,
            toBlock: `0x${end.toString(16)}`,
          },
        ],
      } as never)) as RawLog[];
      allLogs.push(...chunk);
      succeeded++;
    } catch (err) {
      failed++;
      console.error(`[missing-team-rewards] eth_getLogs chunk ${start}-${end} failed:`, err);
    }
  }

  // 全部分段都失败 → 抛错，避免误报"未发现缺失"
  if (succeeded === 0 && failed > 0) {
    throw new Error(`链上日志查询失败（${failed} 个区块段全部失败），请稍后重试或更换 RPC`);
  }

  if (allLogs.length === 0) return [];

  // 候选事件（手动解码 topics/data）
  const candidates: MissingTeamReward[] = [];
  const beneficiaries = new Set<string>();
  for (const log of allLogs) {
    const txHash = log.transactionHash?.toLowerCase();
    if (!txHash || log.logIndex == null || !log.topics || log.topics.length < 3) continue;
    const recipient = ("0x" + log.topics[1].slice(-40)).toLowerCase();
    const claimer = ("0x" + log.topics[2].slice(-40)).toLowerCase();
    const bonus = log.data && log.data !== "0x" ? BigInt(log.data) : 0n;
    if (bonus <= 0n) continue;

    const logIndex = parseInt(log.logIndex, 16);
    beneficiaries.add(recipient);
    candidates.push({
      txHash,
      logIndex,
      claimTxHash: `${txHash}_${logIndex}`,
      beneficiaryAddr: recipient,
      sourceAddr: claimer,
      amount: Number(bonus) / 1e18,
      blockNumber: parseInt(log.blockNumber, 16),
    });
  }

  if (candidates.length === 0) return [];

  // 一次性拉取这些上级已有的团队奖励记录，按"笔数差"计算缺失
  const existing = await prisma.teamReward.findMany({
    where: { beneficiaryAddr: { in: Array.from(beneficiaries) } },
    select: { claimTxHash: true, beneficiaryAddr: true, sourceAddr: true },
  });

  return computeMissingByCount(candidates, existing);
}

/** 扫描最近 blocksBack 区块（从最新块往回）内缺失的团队奖励。用于手动即时检查。 */
export async function scanMissingTeamRewards(blocksBack = 1000): Promise<MissingTeamReward[]> {
  const latestBlock = await client.getBlockNumber();
  const rawFrom = latestBlock - BigInt(blocksBack);
  const fromBlock = rawFrom < DEPLOY_BLOCK ? DEPLOY_BLOCK : rawFrom;
  return scanMissingTeamRewardsRange(fromBlock, latestBlock);
}

/**
 * 断点续扫：从 lastBlock 之后扫到最新（单次最多 maxStep 块），补录缺失并返回新断点。
 * lastBlock 为 null 时从合约部署块开始，分批把全部历史扫完。
 */
export async function scanAndRepairForwardTeamRewards(
  lastBlock: number | null,
  maxStep = 100000
): Promise<{ repaired: number; skipped: number; fromBlock: number; toBlock: number; latest: number; caughtUp: boolean }> {
  const latest = await client.getBlockNumber();
  const start = lastBlock == null ? DEPLOY_BLOCK : BigInt(lastBlock) + 1n;

  if (start > latest) {
    return { repaired: 0, skipped: 0, fromBlock: Number(start), toBlock: Number(latest), latest: Number(latest), caughtUp: true };
  }

  const to = start + BigInt(maxStep) - 1n > latest ? latest : start + BigInt(maxStep) - 1n;
  const missing = await scanMissingTeamRewardsRange(start, to);

  let repaired = 0;
  let skipped = 0;
  for (const m of missing) {
    try {
      (await repairMissingTeamReward(m)) ? repaired++ : skipped++;
    } catch (e) {
      console.error(`[missing-team-rewards] forward repair failed tx=${m.txHash}:`, e);
      skipped++;
    }
  }

  return { repaired, skipped, fromBlock: Number(start), toBlock: Number(to), latest: Number(latest), caughtUp: to >= latest };
}

/** 确保用户存在（外键约束）。缺失时按 max(uid)+1 创建最小记录。 */
async function ensureUser(walletAddress: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { walletAddress },
    select: { walletAddress: true },
  });
  if (user) return;

  const maxRow = await prisma.user.findFirst({ orderBy: { uid: "desc" }, select: { uid: true } });
  const uid = (maxRow?.uid ?? 100000) + 1;
  try {
    await prisma.user.create({ data: { walletAddress, uid } });
    console.log(`[missing-team-rewards] auto-created user ${walletAddress} uid=${uid}`);
  } catch {
    // 竞态：已被其他请求创建，忽略
  }
}

/**
 * 解析该笔奖励对应的 sourceOrderTx（外键，指向 stake_orders）。
 * 优先用这笔领取交易对应的 claim 记录的订单；查不到则退回下级最近的订单。
 */
async function resolveSourceOrderTx(txHash: string, sourceAddr: string): Promise<string | null> {
  const claim = await prisma.claimRecord.findFirst({
    where: { txHash },
    select: { orderTxHash: true },
  });
  if (claim?.orderTxHash) return claim.orderTxHash;

  const order = await prisma.stakeOrder.findFirst({
    where: { walletAddress: sourceAddr },
    orderBy: { startTime: "desc" },
    select: { txHash: true },
  });
  return order?.txHash ?? null;
}

/** 补录单条团队奖励（按精确 claimTxHash 幂等）。若已存在或无法满足外键则安全跳过/报错。 */
export async function repairMissingTeamReward(m: MissingTeamReward): Promise<boolean> {
  // 幂等：按精确 claimTxHash（含 logIndex）判重，保证同交易同上级的多笔奖励各自独立补录
  const existing = await prisma.teamReward.findFirst({
    where: { claimTxHash: m.claimTxHash },
    select: { id: true },
  });
  if (existing) return false;

  await ensureUser(m.beneficiaryAddr);
  await ensureUser(m.sourceAddr);

  const sourceOrderTx = await resolveSourceOrderTx(m.txHash, m.sourceAddr);
  if (!sourceOrderTx) {
    throw new Error(
      `无法确定 sourceOrderTx（下级 ${m.sourceAddr} 在 DB 中没有订单，请先补录其质押订单）`
    );
  }

  try {
    await prisma.teamReward.create({
      data: {
        claimTxHash: m.claimTxHash,
        beneficiaryAddr: m.beneficiaryAddr,
        sourceAddr: m.sourceAddr,
        sourceOrderTx,
        rewardType: "generation",
        generation: null,
        rate: 0,
        amount: m.amount,
        claimed: true, // 团队奖励自动发放，链上已到账
        claimedAt: new Date(),
      },
    });
  } catch (err) {
    // 唯一约束冲突（并发/重复）视为已存在
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
      return false;
    }
    throw err;
  }

  console.log(
    `[missing-team-rewards] repaired claimTx=${m.claimTxHash} 上级=${m.beneficiaryAddr} 下级=${m.sourceAddr} amount=${m.amount}VVV`
  );
  return true;
}

/** 通过 txHash 补录该笔交易里的所有团队奖励（读回执 + 解析事件）。 */
export async function repairTeamRewardByTxHash(
  txHash: string
): Promise<{ repaired: number; skipped: number }> {
  const tx = txHash.toLowerCase();
  const receipt = await client.getTransactionReceipt({ hash: tx as `0x${string}` });
  if (!receipt) throw new Error("交易回执未找到");
  if (receipt.status !== "success") throw new Error("链上交易失败");

  // 1) 解析这笔交易里所有 TeamRewardAccrued 事件（按写死的 topic 匹配，手动解码）
  const candidates: MissingTeamReward[] = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== STAKING_ADDR.toLowerCase()) continue;
    if (log.topics[0]?.toLowerCase() !== TEAM_REWARD_TOPIC) continue;
    if (log.topics.length < 3) continue;
    const bonus = log.data && log.data !== "0x" ? BigInt(log.data) : 0n;
    if (bonus <= 0n) continue;
    candidates.push({
      txHash: tx,
      logIndex: log.logIndex,
      claimTxHash: `${tx}_${log.logIndex}`,
      beneficiaryAddr: ("0x" + log.topics[1].slice(-40)).toLowerCase(),
      sourceAddr: ("0x" + log.topics[2].slice(-40)).toLowerCase(),
      amount: Number(bonus) / 1e18,
      blockNumber: Number(receipt.blockNumber ?? 0n),
    });
  }

  if (candidates.length === 0) throw new Error("该交易未找到 TeamRewardAccrued 事件");

  // 2) 按笔数差算出真正缺失的（同上级多笔也能全部补齐）
  const existing = await prisma.teamReward.findMany({
    where: { claimTxHash: { startsWith: tx } },
    select: { claimTxHash: true, beneficiaryAddr: true, sourceAddr: true },
  });
  const missing = computeMissingByCount(candidates, existing);

  // 3) 补录
  let repaired = 0;
  let skipped = candidates.length - missing.length; // 已存在的
  for (const m of missing) {
    const ok = await repairMissingTeamReward(m);
    ok ? repaired++ : skipped++;
  }
  return { repaired, skipped };
}

/**
 * 对账重建：把某个上级(beneficiary)的团队奖励记录，重建成与链上完全一致。
 * 读该地址收到的全部 TeamRewardAccrued 事件（按 recipient 索引，全历史，便宜），
 * 删掉该上级现有全部记录，再按链上事件逐条以规范键 `${txHash}_${logIndex}` 重新写入。
 * 既能去重（历史上浏览器+服务端不同键格式导致的重复），又能补漏 → 贡献奖励绝对准。
 */
export async function reconcileTeamRewardsForBeneficiary(
  beneficiaryInput: string
): Promise<{ before: number; deleted: number; inserted: number; skipped: number; after: number }> {
  const beneficiary = beneficiaryInput.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(beneficiary)) throw new Error("上级地址格式不正确");
  const topicRecipient = "0x" + beneficiary.slice(2).padStart(64, "0");
  const latest = await client.getBlockNumber();

  // 1) 读链上该上级收到的全部 TeamRewardAccrued（recipient 为 indexed topic1，过滤后很少）
  const allLogs: RawLog[] = [];
  let succeeded = 0;
  let failed = 0;
  for (let start = DEPLOY_BLOCK; start <= latest; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n > latest ? latest : start + LOG_CHUNK - 1n;
    try {
      const chunk = (await client.request({
        method: "eth_getLogs",
        params: [
          {
            address: STAKING_ADDR,
            topics: [TEAM_REWARD_TOPIC, topicRecipient],
            fromBlock: `0x${start.toString(16)}`,
            toBlock: `0x${end.toString(16)}`,
          },
        ],
      } as never)) as RawLog[];
      allLogs.push(...chunk);
      succeeded++;
    } catch (err) {
      failed++;
      console.error(`[reconcile-team] getLogs ${start}-${end} failed:`, err);
    }
  }
  // 有任何区块段读取失败就中止：避免"读不全就删库重建"造成误删
  if (failed > 0) throw new Error(`链上日志查询有 ${failed} 段失败，为避免误删已中止，请稍后重试`);

  // 2) 规范化：每条链上事件一条记录（键 = txHash_十进制logIndex）
  type Canon = { claimTxHash: string; txHash: string; sourceAddr: string; sourceOrderTx: string; amount: number };
  const canonical: Canon[] = [];
  let skipped = 0;
  for (const log of allLogs) {
    const txHash = log.transactionHash?.toLowerCase();
    if (!txHash || log.logIndex == null || !log.topics || log.topics.length < 3) continue;
    const bonus = log.data && log.data !== "0x" ? BigInt(log.data) : 0n;
    if (bonus <= 0n) continue;
    const source = ("0x" + log.topics[2].slice(-40)).toLowerCase();
    const logIndex = parseInt(log.logIndex, 16);
    const sourceOrderTx = await resolveSourceOrderTx(txHash, source);
    if (!sourceOrderTx) { skipped++; continue; } // 下级订单没在库，跳过（先补下级订单）
    canonical.push({ claimTxHash: `${txHash}_${logIndex}`, txHash, sourceAddr: source, sourceOrderTx, amount: Number(bonus) / 1e18 });
  }

  // 3) 删旧建新（重建成与链上一致）
  const before = await prisma.teamReward.count({ where: { beneficiaryAddr: beneficiary } });
  await ensureUser(beneficiary);
  const del = await prisma.teamReward.deleteMany({ where: { beneficiaryAddr: beneficiary } });
  let inserted = 0;
  for (const c of canonical) {
    await ensureUser(c.sourceAddr);
    try {
      await prisma.teamReward.create({
        data: {
          claimTxHash: c.claimTxHash,
          beneficiaryAddr: beneficiary,
          sourceAddr: c.sourceAddr,
          sourceOrderTx: c.sourceOrderTx,
          rewardType: "generation",
          generation: null,
          rate: 0,
          amount: c.amount,
          claimed: true,
          claimedAt: new Date(),
        },
      });
      inserted++;
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") continue;
      throw e;
    }
  }
  const after = await prisma.teamReward.count({ where: { beneficiaryAddr: beneficiary } });
  console.log(`[reconcile-team] ${beneficiary}: before=${before} deleted=${del.count} inserted=${inserted} skipped=${skipped} after=${after}`);
  return { before, deleted: del.count, inserted, skipped, after };
}

/**
 * 全量对账重建：把整张 team_rewards 表重建成与链上完全一致。
 * 读全历史所有 TeamRewardAccrued 事件，删掉整表，按规范键逐条重写。
 * 用于一次性修正"历史上浏览器+服务端重复写"导致的全体上级贡献奖励算错。
 * 任一区块段读取失败即中止（不删库），避免误删。
 */
export async function reconcileAllTeamRewards(): Promise<{
  before: number; deleted: number; inserted: number; skipped: number; after: number; beneficiaries: number;
}> {
  const latest = await client.getBlockNumber();

  const allLogs: RawLog[] = [];
  let succeeded = 0;
  let failed = 0;
  for (let start = DEPLOY_BLOCK; start <= latest; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n > latest ? latest : start + LOG_CHUNK - 1n;
    try {
      const chunk = (await client.request({
        method: "eth_getLogs",
        params: [
          {
            address: STAKING_ADDR,
            topics: [TEAM_REWARD_TOPIC],
            fromBlock: `0x${start.toString(16)}`,
            toBlock: `0x${end.toString(16)}`,
          },
        ],
      } as never)) as RawLog[];
      allLogs.push(...chunk);
      succeeded++;
    } catch (err) {
      failed++;
      console.error(`[reconcile-team-all] getLogs ${start}-${end} failed:`, err);
    }
  }
  // 任一段失败即中止，避免"读不全就删整表"
  if (failed > 0) throw new Error(`链上日志查询有 ${failed} 段失败，为避免误删已中止，请稍后重试`);

  type Canon = { claimTxHash: string; beneficiaryAddr: string; sourceAddr: string; sourceOrderTx: string; amount: number };
  const canonical: Canon[] = [];
  const benefSet = new Set<string>();
  let skipped = 0;
  for (const log of allLogs) {
    const txHash = log.transactionHash?.toLowerCase();
    if (!txHash || log.logIndex == null || !log.topics || log.topics.length < 3) continue;
    const bonus = log.data && log.data !== "0x" ? BigInt(log.data) : 0n;
    if (bonus <= 0n) continue;
    const recipient = ("0x" + log.topics[1].slice(-40)).toLowerCase();
    const source = ("0x" + log.topics[2].slice(-40)).toLowerCase();
    const logIndex = parseInt(log.logIndex, 16);
    const sourceOrderTx = await resolveSourceOrderTx(txHash, source);
    if (!sourceOrderTx) { skipped++; continue; }
    canonical.push({ claimTxHash: `${txHash}_${logIndex}`, beneficiaryAddr: recipient, sourceAddr: source, sourceOrderTx, amount: Number(bonus) / 1e18 });
    benefSet.add(recipient);
  }

  const before = await prisma.teamReward.count();
  const del = await prisma.teamReward.deleteMany({});
  let inserted = 0;
  for (const c of canonical) {
    await ensureUser(c.beneficiaryAddr);
    await ensureUser(c.sourceAddr);
    try {
      await prisma.teamReward.create({
        data: {
          claimTxHash: c.claimTxHash,
          beneficiaryAddr: c.beneficiaryAddr,
          sourceAddr: c.sourceAddr,
          sourceOrderTx: c.sourceOrderTx,
          rewardType: "generation",
          generation: null,
          rate: 0,
          amount: c.amount,
          claimed: true,
          claimedAt: new Date(),
        },
      });
      inserted++;
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") continue;
      throw e;
    }
  }
  const after = await prisma.teamReward.count();
  console.log(`[reconcile-team-all] before=${before} deleted=${del.count} inserted=${inserted} skipped=${skipped} after=${after} beneficiaries=${benefSet.size}`);
  return { before, deleted: del.count, inserted, skipped, after, beneficiaries: benefSet.size };
}

/** 扫描并补录最近 blocksBack 区块内所有缺失的团队奖励。 */
export async function scanAndRepairAllTeamRewards(
  blocksBack = 1000
): Promise<{ repaired: number; skipped: number }> {
  const missing = await scanMissingTeamRewards(blocksBack);
  let repaired = 0;
  let skipped = 0;
  for (const m of missing) {
    try {
      const ok = await repairMissingTeamReward(m);
      ok ? repaired++ : skipped++;
    } catch (err) {
      console.error(`[missing-team-rewards] repair failed tx=${m.txHash}:`, err);
      skipped++;
    }
  }
  return { repaired, skipped };
}
