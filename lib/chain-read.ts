/**
 * Server-side chain reading utilities.
 * Uses viem public client to read contract state — never called from browser.
 */
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const STAKING_ADDR = (
  process.env.NEXT_PUBLIC_VVECO_STAKING ?? "0xc451DdCdDbd9e8700E71960d190b55fE1eD57B34"
) as `0x${string}`;

const RPC_URL =
  process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org";

const client = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const ABI = [
  {
    name: "ordersLength",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
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

export interface ChainOrder {
  orderId: number;
  vvvAmountIn: number;  // in VVV (already divided by 1e18)
  usdValue: number;     // in USD (already divided by 1e18)
  startTime: Date;
  endTime: Date;
  duration: number;     // in days
  dailyRatePct: number; // percent, e.g. 1.0 = 1%/day (converted from permille)
  isCoinBased: boolean;
  isWithdrawn: boolean;
  claimedAmount: number;
}

export async function getOrdersLength(wallet: string): Promise<number> {
  try {
    const len = await client.readContract({
      address: STAKING_ADDR,
      abi: ABI,
      functionName: "ordersLength",
      args: [wallet as `0x${string}`],
    });
    return Number(len);
  } catch {
    return 0;
  }
}

export async function getChainOrder(
  wallet: string,
  orderId: number
): Promise<ChainOrder | null> {
  try {
    const d = await client.readContract({
      address: STAKING_ADDR,
      abi: ABI,
      functionName: "getOrder",
      args: [wallet as `0x${string}`, BigInt(orderId)],
    });
    return {
      orderId,
      vvvAmountIn: Number(d.vvvAmountIn) / 1e18,
      usdValue: Number(d.usdValue) / 1e18,
      startTime: new Date(Number(d.startTime) * 1000),
      endTime: new Date(Number(d.endTime) * 1000),
      duration: Number(d.duration),
      dailyRatePct: Number(d.rate) / 10, // permille → percent
      isCoinBased: d.isCoinBased,
      isWithdrawn: d.isWithdrawn,
      claimedAmount: Number(d.claimedAmount) / 1e18,
    };
  } catch {
    return null;
  }
}

export async function getAllChainOrders(wallet: string): Promise<ChainOrder[]> {
  const length = await getOrdersLength(wallet);
  const results: ChainOrder[] = [];
  for (let i = 0; i < length; i++) {
    const o = await getChainOrder(wallet, i);
    if (o) results.push(o);
  }
  return results;
}

/**
 * Try up to `retries` times (with 1s delay) to fetch the latest order
 * for a wallet. Used right after a stake tx is confirmed — the RPC
 * may lag by 1-2 blocks.
 */
export async function getLatestChainOrder(
  wallet: string,
  retries = 3
): Promise<ChainOrder | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
    const len = await getOrdersLength(wallet);
    if (len === 0) continue;
    const order = await getChainOrder(wallet, len - 1);
    if (order) return order;
  }
  return null;
}
