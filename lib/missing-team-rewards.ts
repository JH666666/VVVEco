/**
 * 团队奖励链上补录。
 * 扫描链上 TeamRewardAccrued 事件，把数据库 team_rewards 表缺失的记录补回。
 * 团队奖励由下级领取时自动打到上级钱包，DB 记录由下级浏览器写入（best-effort），
 * 一旦写库失败，链上已发放但 DB 缺记录 —— 本模块负责补回。
 *
 * 所有数据来自链上，不猜测金额。
 */
import { createPublicClient, http, parseAbiItem, decodeEventLog } from "viem";
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

const TEAM_REWARD_EVENT = parseAbiItem(
  "event TeamRewardAccrued(address indexed recipient, address indexed claimer, uint256 bonus)"
);

export interface MissingTeamReward {
  txHash: string;
  logIndex: number;
  claimTxHash: string; // `${txHash}_${logIndex}`
  beneficiaryAddr: string; // 上级 recipient
  sourceAddr: string; // 下级 claimer
  amount: number; // VVV
  blockNumber: number;
}

/** 用 base txHash + 上级 + 下级 作为逻辑去重键（忽略 claimTxHash 的 _logIndex 后缀差异）。 */
function dedupKey(baseTx: string, beneficiary: string, source: string) {
  return `${baseTx.toLowerCase()}|${beneficiary.toLowerCase()}|${source.toLowerCase()}`;
}

/** 扫描最近 blocksBack 区块内的 TeamRewardAccrued 事件，返回 DB 中缺失的记录。 */
export async function scanMissingTeamRewards(blocksBack = 1000): Promise<MissingTeamReward[]> {
  const latestBlock = await client.getBlockNumber();
  const rawFrom = latestBlock - BigInt(blocksBack);
  const fromBlock = rawFrom < DEPLOY_BLOCK ? DEPLOY_BLOCK : rawFrom;

  const allLogs: Awaited<ReturnType<typeof client.getLogs>> = [];
  for (let start = fromBlock; start <= latestBlock; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n > latestBlock ? latestBlock : start + LOG_CHUNK - 1n;
    try {
      const chunk = await client.getLogs({
        address: STAKING_ADDR,
        event: TEAM_REWARD_EVENT,
        fromBlock: start,
        toBlock: end,
      });
      allLogs.push(...chunk);
    } catch (err) {
      console.error(`[missing-team-rewards] getLogs chunk ${start}-${end} failed:`, err);
    }
  }

  if (allLogs.length === 0) return [];

  // 候选事件
  const candidates: MissingTeamReward[] = [];
  const beneficiaries = new Set<string>();
  for (const log of allLogs) {
    const args = (log as { args?: Record<string, unknown> }).args;
    const txHash = log.transactionHash?.toLowerCase();
    if (!args || !txHash || log.logIndex == null) continue;
    const recipient = (args.recipient as string | undefined)?.toLowerCase();
    const claimer = (args.claimer as string | undefined)?.toLowerCase();
    const bonus = args.bonus as bigint | undefined;
    if (!recipient || !claimer || bonus === undefined || bonus <= 0n) continue;

    beneficiaries.add(recipient);
    candidates.push({
      txHash,
      logIndex: log.logIndex,
      claimTxHash: `${txHash}_${log.logIndex}`,
      beneficiaryAddr: recipient,
      sourceAddr: claimer,
      amount: Number(bonus) / 1e18,
      blockNumber: Number(log.blockNumber ?? 0n),
    });
  }

  if (candidates.length === 0) return [];

  // 一次性拉取这些上级已有的团队奖励记录，构建去重集合
  const existing = await prisma.teamReward.findMany({
    where: { beneficiaryAddr: { in: Array.from(beneficiaries) } },
    select: { claimTxHash: true, beneficiaryAddr: true, sourceAddr: true },
  });
  const existingKeys = new Set(
    existing.map((e) => dedupKey(e.claimTxHash.split("_")[0], e.beneficiaryAddr, e.sourceAddr))
  );

  const missing: MissingTeamReward[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const key = dedupKey(c.txHash, c.beneficiaryAddr, c.sourceAddr);
    if (existingKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    missing.push(c);
  }

  return missing;
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

/** 补录单条团队奖励。若已存在或无法满足外键则安全跳过。 */
export async function repairMissingTeamReward(m: MissingTeamReward): Promise<boolean> {
  // 幂等：再查一次是否已存在
  const existing = await prisma.teamReward.findFirst({
    where: {
      beneficiaryAddr: m.beneficiaryAddr,
      sourceAddr: m.sourceAddr,
      claimTxHash: { startsWith: m.txHash },
    },
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

  console.log(
    `[missing-team-rewards] repaired tx=${m.txHash} 上级=${m.beneficiaryAddr} 下级=${m.sourceAddr} amount=${m.amount}VVV`
  );
  return true;
}

/** 通过 txHash 补录该笔交易里的所有团队奖励（读回执 + 解析事件）。 */
export async function repairTeamRewardByTxHash(
  txHash: string
): Promise<{ repaired: number; skipped: number }> {
  const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  if (!receipt) throw new Error("交易回执未找到");
  if (receipt.status !== "success") throw new Error("链上交易失败");

  let repaired = 0;
  let skipped = 0;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== STAKING_ADDR.toLowerCase()) continue;
    let decoded;
    try {
      decoded = decodeEventLog({ abi: [TEAM_REWARD_EVENT], data: log.data, topics: log.topics });
    } catch {
      continue; // 非本事件
    }
    const a = decoded.args as Record<string, unknown>;
    const recipient = (a.recipient as string).toLowerCase();
    const claimer = (a.claimer as string).toLowerCase();
    const bonus = a.bonus as bigint;
    if (bonus <= 0n) continue;

    const m: MissingTeamReward = {
      txHash: txHash.toLowerCase(),
      logIndex: log.logIndex,
      claimTxHash: `${txHash.toLowerCase()}_${log.logIndex}`,
      beneficiaryAddr: recipient,
      sourceAddr: claimer,
      amount: Number(bonus) / 1e18,
      blockNumber: Number(receipt.blockNumber ?? 0n),
    };
    const ok = await repairMissingTeamReward(m);
    ok ? repaired++ : skipped++;
  }

  if (repaired === 0 && skipped === 0) {
    throw new Error("该交易未找到 TeamRewardAccrued 事件");
  }
  return { repaired, skipped };
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
