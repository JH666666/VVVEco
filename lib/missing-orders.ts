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
}

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

/** Scan Staked events in the last `blocksBack` blocks and return orders missing from DB. */
export async function scanMissingOrders(blocksBack = 1000): Promise<MissingOrder[]> {
  const latestBlock = await client.getBlockNumber();
  const rawFrom = latestBlock - BigInt(blocksBack);
  const fromBlock = rawFrom < DEPLOY_BLOCK ? DEPLOY_BLOCK : rawFrom;

  // Collect all Staked logs in chunks to avoid RPC limits
  const allLogs: Awaited<ReturnType<typeof client.getLogs>> = [];
  for (let start = fromBlock; start <= latestBlock; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n > latestBlock ? latestBlock : start + LOG_CHUNK - 1n;
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
      ...chainData,
    });
  }

  return missing;
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
    ...chainData,
  };
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
  await ensureUser(order.walletAddress);

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
