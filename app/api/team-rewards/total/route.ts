import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";
import { prisma } from "@/lib/prisma";

const STAKING = (process.env.NEXT_PUBLIC_VVECO_STAKING || "0x5ec768D99Cdc49a95E29811Ce97a313f294EBC64") as `0x${string}`;
const RPC_URL = process.env.BASE_MAINNET_RPC || "https://mainnet.base.org";
const DEPLOY_BLOCK = 47_526_639n;
const CHUNK = 2000n;   // Alchemy Free tier safe upper bound
const TTL_MS = 300_000;

const EVENT_ABI = parseAbiItem("event TeamRewardAccrued(address indexed recipient, address indexed claimer, uint256 bonus)");

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL, { retryCount: 2, retryDelay: 600 }),
});

const cache = new Map<string, { total: string; expiresAt: number }>();

// GET /api/team-rewards/total?wallet=0x...
export async function GET(req: NextRequest) {
  const wallet = (req.nextUrl.searchParams.get("wallet") ?? "").trim().toLowerCase() as `0x${string}`;
  if (!/^0x[a-f0-9]{40}$/i.test(wallet)) {
    return NextResponse.json({ total: "0" });
  }

  const cached = cache.get(wallet);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ total: cached.total });
  }

  // DB-first: if no TeamReward rows exist for this wallet, chain has no events yet.
  // Avoids unnecessary eth_getLogs calls on a fresh V2 deployment.
  try {
    const dbCount = await prisma.teamReward.count({ where: { beneficiaryAddr: wallet } });
    if (dbCount === 0) {
      cache.set(wallet, { total: "0", expiresAt: Date.now() + TTL_MS });
      return NextResponse.json({ total: "0" });
    }
  } catch (dbErr) {
    // DB unavailable — fall through to chain scan
    console.warn("[team-rewards/total] DB count failed, falling through to chain scan:", dbErr);
  }

  try {
    const latest = await publicClient.getBlockNumber();

    const chunks: Array<{ from: bigint; to: bigint }> = [];
    for (let from = DEPLOY_BLOCK; from <= latest; from += CHUNK) {
      chunks.push({ from, to: from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n });
    }

    let sum = 0n;
    let succeeded = 0;
    let failed = 0;

    // Sequential to respect Alchemy Free tier CU rate limits
    for (const { from, to } of chunks) {
      try {
        const logs = await publicClient.getLogs({
          address: STAKING,
          event: EVENT_ABI,
          args: { recipient: wallet },
          fromBlock: from,
          toBlock: to,
        });
        succeeded++;
        for (const log of logs) {
          sum += (log.args as { bonus?: bigint }).bonus ?? 0n;
        }
      } catch (err) {
        failed++;
        console.warn(`[team-rewards/total] chunk ${from}-${to} failed for ${wallet}:`, err);
      }
    }

    if (succeeded === 0 && failed > 0) {
      const stale = cache.get(wallet);
      console.warn(`[team-rewards/total] all ${failed} chunks failed for ${wallet}, returning stale cache`);
      return NextResponse.json({ total: stale?.total ?? "0", stale: true });
    }

    if (failed > 0) {
      console.warn(`[team-rewards/total] ${failed}/${succeeded + failed} chunks failed for ${wallet}, result may be understated`);
    }

    const total = sum.toString();
    cache.set(wallet, { total, expiresAt: Date.now() + TTL_MS });
    return NextResponse.json({ total });
  } catch (e) {
    console.error("[team-rewards/total] outer error:", e);
    const stale = cache.get(wallet);
    return NextResponse.json({ total: stale?.total ?? "0", stale: true });
  }
}
