/**
 * Auto-repair utilities for missing stake orders.
 * Scans Staked events on-chain and syncs any orders absent from the DB.
 * All data comes from chain — no guessing of amounts, rates, or periods.
 */
import {
  createPublicClient,
  http,
  parseAbiItem,
  decodeEventLog,
} from "viem";
import { base } from "viem/chains";
import { prisma } from "@/lib/prisma";

// Same charset and logic as POST /api/stake-orders
const CHAR_SET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function generateUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    let code = "";
    do {
      code = Array.from({ length: 8 }, () =>
        CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)]
      ).join("");
    } while (!/[A-Z]/.test(code) || !/\d/.test(code));
    const exists = await prisma.user.findUnique({
      where: { inviteCode: code },
      select: { walletAddress: true },
    });
    if (!exists) return code;
  }
  return `V${Date.now().toString(36).toUpperCase().slice(-7)}`;
}

const STAKING_ADDR = (
  process.env.NEXT_PUBLIC_VVECO_STAKING ?? "0x5ec768D99Cdc49a95E29811Ce97a313f294EBC64"
) as `0x${string}`;

const DEPLOY_BLOCK = 47_526_639n;
const LOG_CHUNK = 2000n;

const RPC_URL = process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org";

const client = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const STAKED_EVENT = parseAbiItem(
  "event Staked(address indexed user, uint256 orderId, uint256 vvvAmountIn, uint256 usdValue, uint256 duration, bool isCoinBased, address referrer)"
);

const ORDER_ABI = [
  {
    name: "getOrder",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "orderId", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "vvvAmountIn", type: "uint256" },
          { name: "usdValue", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "duration", type: "uint256" },
          { name: "rate", type: "uint256" },
          { name: "isCoinBased", type: "bool" },
          { name: "isWithdrawn", type: "bool" },
          { name: "claimedAmount", type: "uint256" },
        ],
      },
    ],
  },
] as const;

export interface MissingOrder {
  txHash: string;
  walletAddress: string;
  orderId: number;
  mode: "coin" | "fiat";
  amount: number;
  usdValue: number;
  period: number;
  dailyRate: number;
  startTime: Date;
  endTime: Date;
  isWithdrawn: boolean;
  referrer?: string; // 链上 Staked 事件里已绑定的推荐人（address(0) 表示无）
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

async function fetchOrderFromChain(
  user: `0x${string}`,
  orderId: number
): Promise<Omit<MissingOrder, "txHash" | "walletAddress" | "orderId"> | null> {
  try {
    const d = await client.readContract({
      address: STAKING_ADDR,
      abi: ORDER_ABI,
      functionName: "getOrder",
      args: [user, BigInt(orderId)],
    });
    return {
      mode: d.isCoinBased ? "coin" : "fiat",
      amount: Number(d.vvvAmountIn) / 1e18,
      usdValue: Number(d.usdValue) / 1e18,
      period: Number(d.duration),
      dailyRate: Number(d.rate) / 10, // permille → percent
      startTime: new Date(Number(d.startTime) * 1000),
      endTime: new Date(Number(d.endTime) * 1000),
      isWithdrawn: d.isWithdrawn,
    };
  } catch {
    return null;
  }
}

/** Scan Staked events in block range [fromBlock, toBlock] and return orders missing from DB. */
export async function scanMissingOrdersRange(
  fromBlock: bigint,
  toBlock: bigint
): Promise<MissingOrder[]> {
  if (fromBlock > toBlock) return [];

  // Collect all Staked logs in chunks to avoid RPC limits
  const allLogs: Awaited<ReturnType<typeof client.getLogs>> = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n > toBlock ? toBlock : start + LOG_CHUNK - 1n;
    try {
      const chunk = await client.getLogs({
        address: STAKING_ADDR,
        event: STAKED_EVENT,
        fromBlock: start,
        toBlock: end,
      });
      allLogs.push(...chunk);
    } catch (err) {
      console.error(`[missing-orders] getLogs chunk ${start}-${end} failed:`, err);
    }
  }

  if (allLogs.length === 0) return [];

  // Deduplicate by txHash
  const txHashes = [
    ...new Set(
      allLogs
        .map((l) => l.transactionHash?.toLowerCase())
        .filter((h): h is string => !!h)
    ),
  ];

  // Batch-check DB for existing orders
  const existing = await prisma.stakeOrder.findMany({
    where: { txHash: { in: txHashes } },
    select: { txHash: true },
  });
  const existingSet = new Set(existing.map((e) => e.txHash.toLowerCase()));

  // Build result: only logs whose txHash is absent from DB
  const missing: MissingOrder[] = [];
  const seenTx = new Set<string>();

  for (const log of allLogs) {
    const txHash = log.transactionHash?.toLowerCase();
    if (!txHash || existingSet.has(txHash) || seenTx.has(txHash)) continue;
    seenTx.add(txHash);

    const args = (log as { args?: Record<string, unknown> }).args;
    if (!args) continue;

    const user = args.user as `0x${string}` | undefined;
    const orderIdBig = args.orderId as bigint | undefined;
    if (!user || orderIdBig === undefined) continue;
    const referrer = (args.referrer as string | undefined)?.toLowerCase();

    const orderId = Number(orderIdBig);
    const chainData = await fetchOrderFromChain(user, orderId);
    if (!chainData) {
      console.warn(`[missing-orders] getOrder failed for ${user} orderId=${orderId} tx=${txHash}`);
      continue;
    }

    missing.push({
      txHash,
      walletAddress: user.toLowerCase(),
      orderId,
      referrer,
      ...chainData,
    });
  }

  return missing;
}

/** Scan the last `blocksBack` blocks (from tip). Used for manual/ad-hoc checks. */
export async function scanMissingOrders(blocksBack = 1000): Promise<MissingOrder[]> {
  const latestBlock = await client.getBlockNumber();
  const rawFrom = latestBlock - BigInt(blocksBack);
  const fromBlock = rawFrom < DEPLOY_BLOCK ? DEPLOY_BLOCK : rawFrom;
  return scanMissingOrdersRange(fromBlock, latestBlock);
}

/**
 * Scan a single wallet's Staked events across FULL history (deploy block → tip).
 * Filters the event by the indexed `user`, so even a full-history sweep is cheap
 * (only this address's stakes). This is the most reliable recovery for one address —
 * it does not depend on a recent block window and won't miss old stakes.
 */
export async function scanMissingOrdersForWallet(
  walletInput: string
): Promise<MissingOrder[]> {
  const user = walletInput.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(user)) return [];
  const userAddr = user as `0x${string}`;
  const latest = await client.getBlockNumber();

  const allLogs: Awaited<ReturnType<typeof client.getLogs>> = [];
  for (let start = DEPLOY_BLOCK; start <= latest; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n > latest ? latest : start + LOG_CHUNK - 1n;
    try {
      const chunk = await client.getLogs({
        address: STAKING_ADDR,
        event: STAKED_EVENT,
        args: { user: userAddr },
        fromBlock: start,
        toBlock: end,
      });
      allLogs.push(...chunk);
    } catch (err) {
      console.error(`[missing-orders] wallet getLogs chunk ${start}-${end} failed:`, err);
    }
  }

  if (allLogs.length === 0) return [];

  const txHashes = [
    ...new Set(
      allLogs.map((l) => l.transactionHash?.toLowerCase()).filter((h): h is string => !!h)
    ),
  ];
  const existing = await prisma.stakeOrder.findMany({
    where: { txHash: { in: txHashes } },
    select: { txHash: true },
  });
  const existingSet = new Set(existing.map((e) => e.txHash.toLowerCase()));

  const missing: MissingOrder[] = [];
  const seenTx = new Set<string>();
  for (const log of allLogs) {
    const txHash = log.transactionHash?.toLowerCase();
    if (!txHash || existingSet.has(txHash) || seenTx.has(txHash)) continue;
    seenTx.add(txHash);

    const args = (log as { args?: Record<string, unknown> }).args;
    const logUser = args?.user as `0x${string}` | undefined;
    const orderIdBig = args?.orderId as bigint | undefined;
    if (!logUser || orderIdBig === undefined) continue;
    const referrer = (args?.referrer as string | undefined)?.toLowerCase();

    const orderId = Number(orderIdBig);
    const chainData = await fetchOrderFromChain(logUser, orderId);
    if (!chainData) {
      console.warn(`[missing-orders] getOrder failed for ${logUser} orderId=${orderId} tx=${txHash}`);
      continue;
    }
    missing.push({ txHash, walletAddress: logUser.toLowerCase(), orderId, referrer, ...chainData });
  }

  return missing;
}

/** Scan a single wallet's full history and repair any missing orders. */
export async function scanAndRepairForWallet(
  walletInput: string
): Promise<{ repaired: number; skipped: number; found: number }> {
  const missing = await scanMissingOrdersForWallet(walletInput);
  let repaired = 0;
  let skipped = 0;
  for (const order of missing) {
    try {
      await repairMissingOrder(order);
      repaired++;
    } catch (err) {
      console.error(`[missing-orders] wallet repair failed for ${order.txHash}:`, err);
      skipped++;
    }
  }
  return { repaired, skipped, found: missing.length };
}

/**
 * Checkpoint scan: from `lastBlock`+1 up to tip (at most `maxStep` blocks per run),
 * repair any missing orders, and return the new checkpoint.
 * `lastBlock === null` starts at the deploy block to sweep full history over runs.
 */
export async function scanAndRepairForwardOrders(
  lastBlock: number | null,
  maxStep = 100000
): Promise<{ repaired: number; skipped: number; fromBlock: number; toBlock: number; latest: number; caughtUp: boolean }> {
  const latest = await client.getBlockNumber();
  const start = lastBlock == null ? DEPLOY_BLOCK : BigInt(lastBlock) + 1n;

  if (start > latest) {
    return { repaired: 0, skipped: 0, fromBlock: Number(start), toBlock: Number(latest), latest: Number(latest), caughtUp: true };
  }

  const to = start + BigInt(maxStep) - 1n > latest ? latest : start + BigInt(maxStep) - 1n;
  const missing = await scanMissingOrdersRange(start, to);

  let repaired = 0;
  let skipped = 0;
  for (const order of missing) {
    try {
      await repairMissingOrder(order);
      repaired++;
    } catch (e) {
      console.error(`[missing-orders] forward repair failed tx=${order.txHash}:`, e);
      skipped++;
    }
  }

  return { repaired, skipped, fromBlock: Number(start), toBlock: Number(to), latest: Number(latest), caughtUp: to >= latest };
}

/** Repair a single order using its txHash (reads receipt + event + chain state). */
export async function repairOrderByTxHash(txHash: string): Promise<MissingOrder> {
  const receipt = await client.getTransactionReceipt({
    hash: txHash as `0x${string}`,
  });

  if (!receipt) throw new Error("Transaction not found");
  if (receipt.status !== "success") throw new Error("Transaction failed on-chain");
  if (receipt.to?.toLowerCase() !== STAKING_ADDR.toLowerCase()) {
    throw new Error("Transaction is not addressed to the staking contract");
  }

  let user: `0x${string}` | null = null;
  let orderId: number | null = null;
  let referrer: string | undefined;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== STAKING_ADDR.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: [STAKED_EVENT],
        data: log.data,
        topics: log.topics,
      });
      const a = decoded.args as Record<string, unknown>;
      user = a.user as `0x${string}`;
      orderId = Number(a.orderId as bigint);
      referrer = (a.referrer as string | undefined)?.toLowerCase();
      break;
    } catch {
      // not this event
    }
  }

  if (!user || orderId === null) throw new Error("Staked event not found in transaction logs");

  const chainData = await fetchOrderFromChain(user, orderId);
  if (!chainData) throw new Error("getOrder RPC call failed");

  return {
    txHash: txHash.toLowerCase(),
    walletAddress: user.toLowerCase(),
    orderId,
    referrer,
    ...chainData,
  };
}

/**
 * Self-heal additive columns on the RUNTIME database.
 *
 * `prisma db push` from an interactive shell can miss the column when the pm2
 * process runs with a different DATABASE_URL than the shell. Running the ALTER
 * through the app's own Prisma connection guarantees it lands in the exact DB
 * the server opens. Idempotent: duplicate-column errors are ignored. Runs once
 * per process (cached promise).
 */
let columnsEnsured: Promise<void> | null = null;
export function ensureStakeOrderColumns(): Promise<void> {
  if (columnsEnsured) return columnsEnsured;
  columnsEnsured = (async () => {
    const stmts = [
      `ALTER TABLE "stake_orders" ADD COLUMN "is_repaired" BOOLEAN NOT NULL DEFAULT false`,
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
  return columnsEnsured;
}

/** Ensure a user row exists (FK constraint). Creates a minimal record if absent. */
async function ensureUser(walletAddress: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { walletAddress },
    select: { walletAddress: true },
  });
  if (user) return;

  const maxRow = await prisma.user.findFirst({
    orderBy: { uid: "desc" },
    select: { uid: true },
  });
  const uid = (maxRow?.uid ?? 100000) + 1;

  try {
    await prisma.user.create({
      data: { walletAddress, uid },
    });
    console.log(`[missing-orders] auto-created user ${walletAddress} uid=${uid}`);
  } catch {
    // Race condition: another request created the user, that's fine
  }
}

/** Upsert a missing order to the DB and mark it as repaired. */
export async function repairMissingOrder(order: MissingOrder): Promise<void> {
  await ensureStakeOrderColumns();
  await ensureUser(order.walletAddress);

  // 从链上 Staked 事件同步推荐关系（referrer），让"推荐"也服务端落库、不依赖用户浏览器注册。
  // 只在数据库尚未有推荐人时回填；不覆盖已有关系。address(0)/自己/root 视为无效。
  if (order.referrer && order.referrer !== ZERO_ADDR && order.referrer !== order.walletAddress) {
    try {
      const self = await prisma.user.findUnique({
        where: { walletAddress: order.walletAddress },
        select: { referrerAddress: true },
      });
      if (self && !self.referrerAddress) {
        await ensureUser(order.referrer);
        await prisma.user.update({
          where: { walletAddress: order.walletAddress },
          data: { referrerAddress: order.referrer },
        });
        console.log(`[missing-orders] backfilled referrer ${order.walletAddress} <- ${order.referrer}`);
      }
    } catch (e) {
      console.warn(`[missing-orders] referrer backfill failed for ${order.walletAddress}:`, e);
    }
  }

  await prisma.stakeOrder.upsert({
    where: { txHash: order.txHash },
    update: {
      amount: order.amount,
      usdValue: order.usdValue,
      dailyRate: order.dailyRate,
      mode: order.mode,
      period: order.period,
      startTime: order.startTime,
      endTime: order.endTime,
      isRepaired: true,
    },
    create: {
      txHash: order.txHash,
      walletAddress: order.walletAddress,
      mode: order.mode,
      amount: order.amount,
      usdValue: order.usdValue,
      period: order.period,
      periodUnit: "day",
      dailyRate: order.dailyRate,
      startTime: order.startTime,
      endTime: order.endTime,
      isWithdrawn: order.isWithdrawn,
      isRepaired: true,
    },
  });

  console.log(
    `[missing-orders] repaired txHash=${order.txHash} wallet=${order.walletAddress} reason=chain_success_db_missing`
  );

  // Generate invite code if user doesn't have one (mirrors POST /api/stake-orders logic)
  const userRecord = await prisma.user.findUnique({
    where: { walletAddress: order.walletAddress },
    select: { inviteCode: true },
  });
  if (userRecord && !userRecord.inviteCode) {
    const inviteCode = await generateUniqueInviteCode();
    await prisma.user.update({
      where: { walletAddress: order.walletAddress },
      data: { inviteCode },
    });
    console.log(`[missing-orders] generated invite code for ${order.walletAddress}`);
  }
}

/** Scan and repair all missing orders in the last `blocksBack` blocks. */
export async function scanAndRepairAll(
  blocksBack = 1000
): Promise<{ repaired: number; skipped: number }> {
  const missing = await scanMissingOrders(blocksBack);
  let repaired = 0;
  let skipped = 0;

  for (const order of missing) {
    try {
      await repairMissingOrder(order);
      repaired++;
    } catch (err) {
      console.error(`[missing-orders] repair failed for ${order.txHash}:`, err);
      skipped++;
    }
  }

  return { repaired, skipped };
}
