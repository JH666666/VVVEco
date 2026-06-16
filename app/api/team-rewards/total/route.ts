import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";

const STAKING = (process.env.NEXT_PUBLIC_VVECO_STAKING || "0xc451DdCdDbd9e8700E71960d190b55fE1eD57B34") as `0x${string}`;
const RPC_URL = process.env.BASE_MAINNET_RPC || "https://mainnet.base.org";
const DEPLOY_BLOCK = 47_346_653n;
const CHUNK = 1990n;
const TTL_MS = 300_000; // 5 分钟缓存，团队奖励不频繁变动
const CONCURRENCY = 5;  // 最多同时 5 个并发块查询

const EVENT_ABI = parseAbiItem("event TeamRewardAccrued(address indexed recipient, address indexed claimer, uint256 bonus)");

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL, { retryCount: 3, retryDelay: 500 }),
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

  try {
    const latest = await publicClient.getBlockNumber();

    // Build chunk list
    const chunks: Array<{ from: bigint; to: bigint }> = [];
    for (let from = DEPLOY_BLOCK; from <= latest; from += CHUNK) {
      chunks.push({ from, to: from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n });
    }

    // Concurrent with controlled parallelism; track success/failure counts
    let sum = 0n;
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(batch.map(({ from, to }) =>
        publicClient.getLogs({
          address: STAKING,
          event: EVENT_ABI,
          args: { recipient: wallet },
          fromBlock: from,
          toBlock: to,
        })
      ));
      for (const r of results) {
        if (r.status === "fulfilled") {
          succeeded++;
          for (const log of r.value) {
            sum += (log.args as { bonus?: bigint }).bonus ?? 0n;
          }
        } else {
          failed++;
          console.warn(`[team-rewards/total] chunk failed for ${wallet}:`, r.reason);
        }
      }
    }

    // All chunks failed — keep existing cache rather than overwriting with 0
    if (succeeded === 0 && failed > 0) {
      const stale = cache.get(wallet);
      console.warn(`[team-rewards/total] all ${failed} chunks failed for ${wallet}, returning stale cache`);
      return NextResponse.json({ total: stale?.total ?? "0", stale: true });
    }

    // Partial failure — return what we got and log a warning
    if (failed > 0) {
      console.warn(`[team-rewards/total] ${failed}/${succeeded + failed} chunks failed for ${wallet}, result may be understated`);
    }

    const total = sum.toString();
    cache.set(wallet, { total, expiresAt: Date.now() + TTL_MS });
    return NextResponse.json({ total });
  } catch (e) {
    // Outer error (e.g. getBlockNumber failed) — preserve cache
    console.error("[team-rewards/total] outer error:", e);
    const stale = cache.get(wallet);
    return NextResponse.json({ total: stale?.total ?? "0", stale: true });
  }
}
