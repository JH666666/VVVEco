import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";

const STAKING = (process.env.NEXT_PUBLIC_VVECO_STAKING || "0xc451DdCdDbd9e8700E71960d190b55fE1eD57B34") as `0x${string}`;

const abi = parseAbi([
  "function levelThresholds(uint256) view returns (uint256)",
  "function levelRates(uint256) view returns (uint256)",
]);

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_MAINNET_RPC || "https://mainnet.base.org"),
});

export async function GET() {
  try {
    const calls = Array.from({ length: 8 }, (_, i) => i + 1).flatMap((level) => [
      client.readContract({ address: STAKING, abi, functionName: "levelThresholds", args: [BigInt(level)] }),
      client.readContract({ address: STAKING, abi, functionName: "levelRates", args: [BigInt(level)] }),
    ]);

    const results = await Promise.all(calls);

    const levelThresholds: number[] = [];
    const levelRates: number[] = [];
    for (let i = 0; i < 8; i++) {
      levelThresholds.push(Math.round(Number(results[i * 2]) / 1e18));
      levelRates.push(Number(results[i * 2 + 1]));
    }

    return NextResponse.json({ levelThresholds, levelRates });
  } catch (e) {
    console.error("level-config error:", e);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
