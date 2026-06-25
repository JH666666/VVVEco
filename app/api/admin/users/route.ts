import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// V1=$0 V2=$10K V3=$20K V4=$30K V5=$50K V6=$100K V7=$150K V8=$200K
const LEVEL_THRESHOLDS = [0, 10000, 20000, 30000, 50000, 100000, 150000, 200000];

function calcLevel(teamUsd: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (teamUsd >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 0;
}

// BFS 7层下级活跃订单 USD 总量（与 users/[wallet] 详情页保持一致）
async function getTeamVolume7(walletAddress: string): Promise<number> {
  let frontier = [walletAddress];
  const visited = new Set([walletAddress]);
  let total = 0;
  const now = new Date();

  for (let depth = 0; depth < 7 && frontier.length > 0; depth++) {
    const children = await prisma.user.findMany({
      where: { referrerAddress: { in: frontier } },
      select: { walletAddress: true, stakeOrders: { select: { usdValue: true, isWithdrawn: true, endTime: true } } },
    });
    if (children.length === 0) break;
    const nextFrontier: string[] = [];
    for (const child of children) {
      if (visited.has(child.walletAddress)) continue;
      visited.add(child.walletAddress);
      nextFrontier.push(child.walletAddress);
      for (const o of child.stakeOrders) {
        if (!o.isWithdrawn && o.endTime > now) total += o.usdValue;
      }
    }
    frontier = nextFrontier;
  }
  return total;
}

// GET /api/admin/users?page=1&pageSize=10&q=&registeredStart=&registeredEnd=&minStake=&maxStake=
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "10", 10)));
    const registeredStart = searchParams.get("registeredStart") ?? "";
    const registeredEnd = searchParams.get("registeredEnd") ?? "";
    const minStake = searchParams.get("minStake") ?? "";
    const maxStake = searchParams.get("maxStake") ?? "";

    const where: Record<string, unknown> = {};

    if (q) {
      const uidNum = parseInt(q, 10);
      where.OR = [
        { walletAddress: { contains: q.toLowerCase() } },
        { inviteCode: { equals: q.toUpperCase() } },
      ];
      if (Number.isFinite(uidNum) && uidNum >= 100001) {
        (where.OR as unknown[]).push({ uid: uidNum });
      }
    }

    if (registeredStart) {
      where.createdAt = { ...(where.createdAt as object ?? {}), gte: new Date(`${registeredStart}T00:00:00.000Z`) };
    }
    if (registeredEnd) {
      where.createdAt = { ...(where.createdAt as object ?? {}), lte: new Date(`${registeredEnd}T23:59:59.999Z`) };
    }

    const minStakeNum = minStake !== "" ? parseFloat(minStake) : null;
    const maxStakeNum = maxStake !== "" ? parseFloat(maxStake) : null;
    if (minStakeNum !== null || maxStakeNum !== null) {
      const having: string[] = [];
      if (minStakeNum !== null && minStakeNum > 0) having.push(`SUM(usd_value) >= ${minStakeNum}`);
      if (maxStakeNum !== null) having.push(`SUM(usd_value) <= ${maxStakeNum}`);
      if (having.length > 0) {
        const rows = await prisma.$queryRawUnsafe<{ wallet_address: string }[]>(
          `SELECT wallet_address FROM stake_orders GROUP BY wallet_address HAVING ${having.join(" AND ")}`
        );
        where.walletAddress = { in: rows.map(r => r.wallet_address) };
      }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { uid: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          referrer: { select: { walletAddress: true } },
          stakeOrders: { include: { claimRecords: { select: { amountUsd: true } } } },
          _count: { select: { referrals: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // 从 DB BFS 7层计算团队业绩和等级（与用户详情页一致，不依赖链上状态）
    const teamVolumes = await Promise.all(
      users.map(u => getTeamVolume7(u.walletAddress))
    );

    const now = new Date();
    const items = users.map((user, i) => {
      const totalStakedUsd = user.stakeOrders.reduce((sum, o) => sum + o.usdValue, 0);
      const activeOrders = user.stakeOrders.filter((o) => !o.isWithdrawn && o.endTime > now);
      const totalRedeemedUsd = user.stakeOrders.filter((o) => o.isWithdrawn).reduce((sum, o) => sum + o.usdValue, 0);
      const teamVolume = teamVolumes[i];
      const effectiveLevel = calcLevel(teamVolume);

      // 已领取 = 所有 claim records 的 amountUsd 之和
      const totalClaimedUsd = user.stakeOrders.reduce(
        (sum, o) => sum + o.claimRecords.reduce((s, c) => s + c.amountUsd, 0),
        0
      );

      // 待领取 = 活跃订单的累计收益 - 已领取部分
      const totalPendingUsd = activeOrders.reduce((sum, o) => {
        const unitMs = o.periodUnit === "hour" ? 3600_000 : 86_400_000;
        const elapsedUnits = Math.max(0, (now.getTime() - o.startTime.getTime()) / unitMs);
        const periodReward = o.usdValue * (o.dailyRate / 100);
        const accrued = Math.min(periodReward * o.period, periodReward * elapsedUnits);
        const claimed = o.claimRecords.reduce((s, c) => s + c.amountUsd, 0);
        return sum + Math.max(0, accrued - claimed);
      }, 0);

      return {
        uid: user.uid,
        address: user.walletAddress,
        displayAddress: `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-6)}`,
        accountLabel: `UID ${user.uid}`,
        inviteCode: user.inviteCode,
        registeredAt: user.createdAt.toLocaleString("zh-CN", { hour12: false }),
        registeredAtMs: user.createdAt.getTime(),
        referrerDisplay: user.referrer
          ? `${user.referrer.walletAddress.slice(0, 6)}...${user.referrer.walletAddress.slice(-6)}`
          : "无",
        directCount: user._count.referrals,
        teamCount: user._count.referrals,
        totalStakedUsd,
        totalRedeemedUsd,
        totalClaimedUsd,
        totalPendingUsd,
        teamVolume,
        effectiveLevel,
        orderCount: user.stakeOrders.length,
        activeOrderCount: activeOrders.length,
      };
    });

    return NextResponse.json({
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
