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

// GET /api/admin/chain-params — each call is independent; one failure won't block owner/minStake
export async function GET() {
  const [minStakeRes, priceRes, ownerRes] = await Promise.allSettled([
    client.readContract({ address: STAKING_ADDR, abi: ABI, functionName: "minStakeUsd" }),
    client.readContract({ address: STAKING_ADDR, abi: ABI, functionName: "getLatestPrice" }),
    client.readContract({ address: STAKING_ADDR, abi: ABI, functionName: "owner" }),
  ]);

  if (minStakeRes.status === "rejected") console.error("chain-params minStakeUsd:", minStakeRes.reason);
  if (priceRes.status === "rejected")    console.error("chain-params getLatestPrice:", priceRes.reason);
  if (ownerRes.status === "rejected")    console.error("chain-params owner:", ownerRes.reason);

  return NextResponse.json({
    minStakeUsd:  minStakeRes.status === "fulfilled" ? formatEther(minStakeRes.value) : null,
    currentPrice: priceRes.status    === "fulfilled" ? formatEther(priceRes.value)    : null,
    owner:        ownerRes.status    === "fulfilled" ? ownerRes.value                  : null,
  });
}
