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

  // DB-first: sum directly from TeamReward table — avoids scanning 300k+ blocks per request.
  // DB is authoritative when records exist; chain scan only runs as fallback when DB is empty.
  try {
    const dbAgg = await prisma.teamReward.aggregate({
      where: { beneficiaryAddr: wallet },
      _sum: { amount: true },
      _count: { id: true },
    });
    if (dbAgg._count.id === 0) {
      // No DB records at all — fall through to chain scan (new wallet, no rewards yet)
    } else {
      // amount is stored in VVV; convert to wei string to match chain-scan format
      const vvv = dbAgg._sum.amount ?? 0;
      const weiTotal = BigInt(Math.round(vvv * 1e12)) * BigInt(1e6); // avoid float overflow
      const total = weiTotal.toString();
      cache.set(wallet, { total, expiresAt: Date.now() + TTL_MS });
      return NextResponse.json({ total });
    }
  } catch (dbErr) {
    // DB unavailable — fall through to chain scan
    console.warn("[team-rewards/total] DB sum failed, falling through to chain scan:", dbErr);
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
