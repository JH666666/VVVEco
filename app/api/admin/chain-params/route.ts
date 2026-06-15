import { NextResponse } from "next/server";
import { createPublicClient, http, formatEther } from "viem";
import { base } from "viem/chains";

const STAKING_ADDR = (process.env.NEXT_PUBLIC_VVECO_STAKING || "0xc451DdCdDbd9e8700E71960d190b55fE1eD57B34") as `0x${string}`;

const ABI = [
  { name: "minStakeUsd", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getLatestPrice", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org"),
});

// GET /api/admin/chain-params — returns minStakeUsd and currentPrice (real-time Aerodrome+Chainlink) from chain
export async function GET() {
  try {
    const [minStakeRaw, priceRaw, ownerAddr] = await Promise.all([
      client.readContract({ address: STAKING_ADDR, abi: ABI, functionName: "minStakeUsd" }),
      client.readContract({ address: STAKING_ADDR, abi: ABI, functionName: "getLatestPrice" }),
      client.readContract({ address: STAKING_ADDR, abi: ABI, functionName: "owner" }),
    ]);
    return NextResponse.json({
      minStakeUsd: formatEther(minStakeRaw),
      currentPrice: formatEther(priceRaw),
      owner: ownerAddr,
    });
  } catch (e) {
    console.error("chain-params error:", e);
    return NextResponse.json({ error: "chain read failed" }, { status: 500 });
  }
}
