/**
 * 领取记录补录：扫描链上 RewardClaimed 事件，把缺失的领取记录写进数据库。
 * 用途：即使用户在领取转圈中关掉页面、前端没来得及写库，服务端也能从链上补齐领取记录，
 *      让「已获收益」不依赖浏览器。所有金额来自链上，不猜测。
 *
 * RewardClaimed(user, vvvGross) 不带 orderId，用该笔交易的调用数据解析出 orderId
 * （claimOrderReward(orderId)），再按"该地址订单按开始时间升序的位置=链上 orderId"映射到订单 txHash。
 * claimAllRewards()（一次领多单、只发一条汇总事件）无法拆分到单，跳过——dApp 只用单单领取。
 */
import { createPublicClient, http, parseAbiItem, parseAbi, decodeFunctionData } from "viem";
import { base } from "viem/chains";
import { prisma } from "@/lib/prisma";

const STAKING_ADDR = (
  process.env.NEXT_PUBLIC_VVECO_STAKING ?? "0x5ec768D99Cdc49a95E29811Ce97a313f294EBC64"
) as `0x${string}`;

const DEPLOY_BLOCK = 47_526_639n;
const LOG_CHUNK = 2000n;
const RPC_URL = process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org";

const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

const REWARD_CLAIMED_EVENT = parseAbiItem(
  "event RewardClaimed(address indexed user, uint256 vvvGross)"
);
const CLAIM_FN_ABI = parseAbi([
  "function claimOrderReward(uint256 orderId)",
  "function claimAllRewards()",
]);
const PRICE_ABI = [
  { name: "getLatestPrice", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export interface MissingClaim {
  txHash: string;
  orderTxHash: string;
  walletAddress: string;
  amount: number;      // 展示单位：coin=VVV，fiat=USD（均为税前/gross）
  amountVvv: number;   // gross VVV
  amountUsd: number;   // gross USD
  priceAtClaim: number;
}

/** (user, 链上 orderId) → 订单 txHash：该地址订单按开始时间升序，位置即链上 orderId。 */
async function orderTxForOrderId(user: string, orderId: number): Promise<{ txHash: string; mode: string } | null> {
  const orders = await prisma.stakeOrder.findMany({
    where: { walletAddress: user },
    select: { txHash: true, mode: true, startTime: true },
    orderBy: { startTime: "asc" },
  });
  const o = orders[orderId];
  return o ? { txHash: o.txHash, mode: o.mode } : null;
}

const priceCache = new Map<string, number>();
async function priceAtBlock(blockNumber: bigint | null | undefined): Promise<number> {
  if (blockNumber == null) return 0;
  const key = blockNumber.toString();
  const cached = priceCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const p = await client.readContract({
      address: STAKING_ADDR, abi: PRICE_ABI, functionName: "getLatestPrice", blockNumber,
    });
    const price = Number(p as bigint) / 1e18;
    priceCache.set(key, price);
    return price;
  } catch {
    return 0;
  }
}

/** 解析单条 RewardClaimed 日志 → MissingClaim（读交易取 orderId、按块取价）。无法归单则返回 null。 */
async function buildClaimFromLog(log: {
  transactionHash?: string | null;
  blockNumber?: bigint | null;
  args?: Record<string, unknown>;
}): Promise<MissingClaim | null> {
  const txHash = log.transactionHash?.toLowerCase();
  const user = (log.args?.user as string | undefined)?.toLowerCase();
  const vvvGross = log.args?.vvvGross as bigint | undefined;
  if (!txHash || !user || vvvGross === undefined || vvvGross <= 0n) return null;

  // 从交易调用数据解析 orderId（只认单单领取 claimOrderReward）
  let orderId: number | null = null;
  try {
    const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
    const decoded = decodeFunctionData({ abi: CLAIM_FN_ABI, data: tx.input });
    if (decoded.functionName === "claimOrderReward") orderId = Number((decoded.args as readonly bigint[])[0]);
    else return null; // claimAllRewards：汇总事件，无法拆单，跳过
  } catch {
    return null; // 非本合约领取函数 / 解析失败
  }
  if (orderId == null || Number.isNaN(orderId)) return null;

  const mapped = await orderTxForOrderId(user, orderId);
  if (!mapped) {
    console.warn(`[missing-claims] order not in DB for ${user} orderId=${orderId} tx=${txHash}`);
    return null;
  }

  const price = await priceAtBlock(log.blockNumber);
  const amountVvv = Number(vvvGross) / 1e18;
  const amountUsd = amountVvv * price;
  const amount = mapped.mode === "coin" ? amountVvv : amountUsd;
  return { txHash, orderTxHash: mapped.txHash, walletAddress: user, amount, amountVvv, amountUsd, priceAtClaim: price };
}

/** 扫描区块范围内 RewardClaimed，返回数据库中缺失的领取记录。 */
export async function scanMissingClaimsRange(fromBlock: bigint, toBlock: bigint): Promise<MissingClaim[]> {
  if (fromBlock > toBlock) return [];

  const allLogs: Awaited<ReturnType<typeof client.getLogs>> = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n > toBlock ? toBlock : start + LOG_CHUNK - 1n;
    try {
      const chunk = await client.getLogs({ address: STAKING_ADDR, event: REWARD_CLAIMED_EVENT, fromBlock: start, toBlock: end });
      allLogs.push(...chunk);
    } catch (err) {
      console.error(`[missing-claims] getLogs chunk ${start}-${end} failed:`, err);
    }
  }
  if (allLogs.length === 0) return [];

  // 已在库的（claim 记录以 txHash 为主键）
  const txHashes = [...new Set(allLogs.map((l) => l.transactionHash?.toLowerCase()).filter((h): h is string => !!h))];
  const existing = await prisma.claimRecord.findMany({ where: { txHash: { in: txHashes } }, select: { txHash: true } });
  const existingSet = new Set(existing.map((e) => e.txHash.toLowerCase()));

  const missing: MissingClaim[] = [];
  const seen = new Set<string>();
  for (const log of allLogs) {
    const txHash = log.transactionHash?.toLowerCase();
    if (!txHash || existingSet.has(txHash) || seen.has(txHash)) continue;
    seen.add(txHash);
    const built = await buildClaimFromLog(log as never);
    if (built) missing.push(built);
  }
  return missing;
}

/** 写入一条领取记录（幂等：txHash 主键已存在则不动）。 */
export async function repairMissingClaim(c: MissingClaim): Promise<boolean> {
  try {
    await prisma.claimRecord.upsert({
      where: { txHash: c.txHash },
      update: {},
      create: {
        txHash: c.txHash,
        orderTxHash: c.orderTxHash,
        walletAddress: c.walletAddress,
        amount: c.amount,
        amountVvv: c.amountVvv,
        amountUsd: c.amountUsd,
        priceAtClaim: c.priceAtClaim,
        feeAmount: 0,
      },
    });
    console.log(`[missing-claims] repaired claim tx=${c.txHash} order=${c.orderTxHash} amount=${c.amount}`);
    return true;
  } catch (e) {
    console.error(`[missing-claims] repair failed tx=${c.txHash}:`, e);
    return false;
  }
}

/** 扫描并补录一个区块范围（供调度器按断点调用）。 */
export async function scanAndRepairClaimsRange(fromBlock: number, toBlock: number): Promise<{ repaired: number; skipped: number }> {
  const missing = await scanMissingClaimsRange(BigInt(fromBlock), BigInt(toBlock));
  let repaired = 0;
  let skipped = 0;
  for (const c of missing) {
    (await repairMissingClaim(c)) ? repaired++ : skipped++;
  }
  return { repaired, skipped };
}

/**
 * 断点续扫：从 lastBlock+1 扫到 tip（单轮最多 maxStep 区块），补录缺失领取记录，返回新断点。
 * lastBlock === null 从合约部署块开始，分多轮扫完全历史。
 */
export async function scanAndRepairForwardClaims(
  lastBlock: number | null,
  maxStep = 100_000
): Promise<{ repaired: number; skipped: number; fromBlock: number; toBlock: number; latest: number; caughtUp: boolean }> {
  const latest = await client.getBlockNumber();
  const start = lastBlock == null ? DEPLOY_BLOCK : BigInt(lastBlock) + 1n;
  if (start > latest) {
    return { repaired: 0, skipped: 0, fromBlock: Number(start), toBlock: Number(latest), latest: Number(latest), caughtUp: true };
  }
  const to = start + BigInt(maxStep) - 1n > latest ? latest : start + BigInt(maxStep) - 1n;
  const missing = await scanMissingClaimsRange(start, to);
  let repaired = 0;
  let skipped = 0;
  for (const c of missing) {
    (await repairMissingClaim(c)) ? repaired++ : skipped++;
  }
  return { repaired, skipped, fromBlock: Number(start), toBlock: Number(to), latest: Number(latest), caughtUp: to >= latest };
}

/** 扫描最近 blocksBack 区块（供后台手动扫描）。 */
export async function scanMissingClaims(blocksBack = 2000): Promise<MissingClaim[]> {
  const latest = await client.getBlockNumber();
  const rawFrom = latest - BigInt(blocksBack);
  const fromBlock = rawFrom < DEPLOY_BLOCK ? DEPLOY_BLOCK : rawFrom;
  return scanMissingClaimsRange(fromBlock, latest);
}

/**
 * 自愈 auto_scan_config 表的 missing_claim_* 列（通过 App 自身连接，避免 CLI/env 不一致）。
 * 幂等、每进程一次；重复列错误忽略。
 */
let claimCfgColsEnsured: Promise<void> | null = null;
export function ensureAutoScanClaimColumns(): Promise<void> {
  if (claimCfgColsEnsured) return claimCfgColsEnsured;
  claimCfgColsEnsured = (async () => {
    // 先整表自愈：pm2 实际库里可能根本没有 auto_scan_config 表
    // （CLI 迁移写到了另一个 DB 文件）。整张表用 IF NOT EXISTS 建好。
    const createSql = `CREATE TABLE IF NOT EXISTS "auto_scan_config" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "team_reward_enabled" BOOLEAN NOT NULL DEFAULT false,
      "team_reward_interval_min" INTEGER NOT NULL DEFAULT 10,
      "team_reward_blocks_back" INTEGER NOT NULL DEFAULT 2000,
      "team_reward_last_run_at" DATETIME,
      "team_reward_last_result" TEXT,
      "team_reward_last_block" INTEGER,
      "missing_order_enabled" BOOLEAN NOT NULL DEFAULT false,
      "missing_order_interval_min" INTEGER NOT NULL DEFAULT 10,
      "missing_order_blocks_back" INTEGER NOT NULL DEFAULT 2000,
      "missing_order_last_run_at" DATETIME,
      "missing_order_last_result" TEXT,
      "missing_order_last_block" INTEGER,
      "missing_claim_enabled" BOOLEAN NOT NULL DEFAULT false,
      "missing_claim_interval_min" INTEGER NOT NULL DEFAULT 10,
      "missing_claim_blocks_back" INTEGER NOT NULL DEFAULT 2000,
      "missing_claim_last_run_at" DATETIME,
      "missing_claim_last_result" TEXT,
      "missing_claim_last_block" INTEGER,
      "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;
    try {
      await prisma.$executeRawUnsafe(createSql);
      console.log("[db-ensure] ensured table auto_scan_config");
    } catch (e) {
      console.warn("[db-ensure] create auto_scan_config failed:", e instanceof Error ? e.message : String(e));
    }
    // 兜底：老库已有表但缺新列时逐列补齐（重复列忽略）。
    const stmts = [
      `ALTER TABLE "auto_scan_config" ADD COLUMN "missing_order_enabled" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "auto_scan_config" ADD COLUMN "missing_order_interval_min" INTEGER NOT NULL DEFAULT 10`,
      `ALTER TABLE "auto_scan_config" ADD COLUMN "missing_order_blocks_back" INTEGER NOT NULL DEFAULT 2000`,
      `ALTER TABLE "auto_scan_config" ADD COLUMN "missing_order_last_run_at" DATETIME`,
      `ALTER TABLE "auto_scan_config" ADD COLUMN "missing_order_last_result" TEXT`,
      `ALTER TABLE "auto_scan_config" ADD COLUMN "missing_order_last_block" INTEGER`,
      `ALTER TABLE "auto_scan_config" ADD COLUMN "missing_claim_enabled" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "auto_scan_config" ADD COLUMN "missing_claim_interval_min" INTEGER NOT NULL DEFAULT 10`,
      `ALTER TABLE "auto_scan_config" ADD COLUMN "missing_claim_blocks_back" INTEGER NOT NULL DEFAULT 2000`,
      `ALTER TABLE "auto_scan_config" ADD COLUMN "missing_claim_last_run_at" DATETIME`,
      `ALTER TABLE "auto_scan_config" ADD COLUMN "missing_claim_last_result" TEXT`,
      `ALTER TABLE "auto_scan_config" ADD COLUMN "missing_claim_last_block" INTEGER`,
    ];
    for (const sql of stmts) {
      try {
        await prisma.$executeRawUnsafe(sql);
        console.log("[db-ensure] applied:", sql);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/duplicate column|already exists/i.test(msg)) continue;
        console.warn("[db-ensure] skip:", sql, "-", msg);
      }
    }
  })();
  return claimCfgColsEnsured;
}

/** 按单笔领取交易哈希补录（供后台手动补录）。 */
export async function repairClaimByTxHash(txHash: string): Promise<{ repaired: number; skipped: number }> {
  const tx = txHash.toLowerCase();
  const receipt = await client.getTransactionReceipt({ hash: tx as `0x${string}` });
  if (!receipt) throw new Error("交易回执未找到");
  if (receipt.status !== "success") throw new Error("链上交易失败");

  const built: MissingClaim[] = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== STAKING_ADDR.toLowerCase()) continue;
    // RewardClaimed 的 topic0 由事件签名决定；用 viem 解码，非该事件会抛错被跳过
    try {
      const { decodeEventLog } = await import("viem");
      const decoded = decodeEventLog({ abi: [REWARD_CLAIMED_EVENT], data: log.data, topics: log.topics });
      const c = await buildClaimFromLog({
        transactionHash: tx,
        blockNumber: receipt.blockNumber ?? null,
        args: decoded.args as Record<string, unknown>,
      });
      if (c) built.push(c);
    } catch {
      // 不是 RewardClaimed 事件
    }
  }
  if (built.length === 0) throw new Error("该交易未找到可归单的 RewardClaimed 事件");

  let repaired = 0;
  let skipped = 0;
  for (const c of built) {
    (await repairMissingClaim(c)) ? repaired++ : skipped++;
  }
  return { repaired, skipped };
}

export { DEPLOY_BLOCK as CLAIMS_DEPLOY_BLOCK };
