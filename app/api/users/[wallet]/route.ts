import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_LEVEL_THRESHOLDS = [0, 10000, 20000, 30000, 50000, 100000, 150000, 200000];
const DAY_MS = 24 * 60 * 60 * 1000;

function calculateLevel(teamStake: number, thresholds: number[]) {
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (teamStake >= (thresholds[i] ?? 0)) return i + 1;
  }
  return 1;
}

function formatDatetime(date: Date) {
  return date.toLocaleString("zh-CN", { hour12: false });
}

function shortAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

// BFS downstream referrals up to 7 levels
async function collectTeam(rootAddr: string) {
  const result: Array<{ address: string; level: number }> = [];
  let frontier = [rootAddr];
  const visited = new Set([rootAddr]);

  for (let level = 1; level <= 7 && frontier.length > 0; level++) {
    const children = await prisma.user.findMany({
      where: { referrerAddress: { in: frontier } },
      select: { walletAddress: true },
    });
    frontier = [];
    for (const child of children) {
      if (!visited.has(child.walletAddress)) {
        visited.add(child.walletAddress);
        result.push({ address: child.walletAddress, level });
        frontier.push(child.walletAddress);
      }
    }
  }
  return result;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    const walletAddress = wallet.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: {
        referrer: { select: { walletAddress: true, uid: true } },
        _count: { select: { referrals: true } },
        stakeOrders: {
          where: { hiddenByAdmin: false },
          orderBy: { createdAt: "desc" },
          include: {
            claimRecords: {
              select: { amountVvv: true, amountUsd: true },
            },
          },
        },
        teamRewardsAsBeneficiary: {
          select: { amount: true, claimed: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ notFound: true, address: walletAddress });
    }

    const now = Date.now();

    // ── Compute per-order insight ──
    const orders = user.stakeOrders.map((order) => {
      const unitMs = order.periodUnit === "hour" ? 60 * 60 * 1000 : DAY_MS;
      const startMs = order.startTime.getTime();
      const endMs = order.endTime.getTime();
      const periodMs = Math.max(1, endMs - startMs);
      const elapsedMs = Math.max(0, now - startMs);

      const periodReward =
        order.mode === "coin"
          ? order.amount * (order.dailyRate / 100)
          : order.usdValue * (order.dailyRate / 100);
      const totalExpected = periodReward * order.period;
      const accrued = Math.min(totalExpected, periodReward * (elapsedMs / unitMs));

      const claimedVvv = order.claimRecords.reduce((s, c) => s + c.amountVvv, 0);
      const claimedUsd = order.claimRecords.reduce((s, c) => s + c.amountUsd, 0);
      const claimed = order.mode === "coin" ? claimedVvv : claimedUsd;
      const pending = Math.max(0, accrued - claimed);
      const pendingUsd = order.mode === "coin" ? pending * 0.15 : pending;
      const progressPercent = Math.min(100, Math.max(0, (elapsedMs / periodMs) * 100));
      const isActive = !order.isWithdrawn && endMs > now;

      return {
        id: order.txHash,
        mode: order.mode as "coin" | "fiat",
        amount: order.amount,
        usdValue: order.usdValue,
        period: order.period,
        periodUnit: (order.periodUnit ?? "day") as "day" | "hour",
        dailyRate: order.dailyRate,
        createdAt: formatDatetime(order.createdAt),
        startsAt: formatDatetime(order.startTime),
        expiresAt: formatDatetime(order.endTime),
        claimed,
        claimedUsd,
        pending,
        pendingUsd,
        totalExpected,
        progressPercent,
        status: isActive ? ("进行中" as const) : ("已完成" as const),
      };
    });

    // ── Totals ──
    const totalStakedUsd = user.stakeOrders.reduce((s, o) => s + o.usdValue, 0);
    const totalRedeemedUsd = user.stakeOrders
      .filter((o) => o.isWithdrawn)
      .reduce((s, o) => s + o.usdValue, 0);
    const personalClaimedUsd = orders.reduce((s, o) => s + o.claimedUsd, 0);
    const personalPendingUsd = orders.reduce((s, o) => s + o.pendingUsd, 0);

    const teamRewardRecords = user.teamRewardsAsBeneficiary;
    const teamClaimedUsd = teamRewardRecords
      .filter((r) => r.claimed)
      .reduce((s, r) => s + r.amount, 0);
    const teamPendingUsd = teamRewardRecords
      .filter((r) => !r.claimed)
      .reduce((s, r) => s + r.amount, 0);
    const teamRewardUsd = teamClaimedUsd + teamPendingUsd;

    // ── Team (BFS 7 levels) ──
    const teamMembers = await collectTeam(walletAddress);
    const teamAddresses = teamMembers.map((m) => m.address);

    const teamOrders =
      teamAddresses.length > 0
        ? await prisma.stakeOrder.findMany({
            where: {
              walletAddress: { in: teamAddresses },
              hiddenByAdmin: false,
              isWithdrawn: false,
              endTime: { gt: new Date() },
            },
            select: { walletAddress: true, usdValue: true },
          })
        : [];

    const stakeByMember: Record<string, number> = {};
    const countByMember: Record<string, number> = {};
    for (const o of teamOrders) {
      stakeByMember[o.walletAddress] = (stakeByMember[o.walletAddress] ?? 0) + o.usdValue;
      countByMember[o.walletAddress] = (countByMember[o.walletAddress] ?? 0) + 1;
    }

    const team = teamMembers.map((m) => ({
      address: m.address,
      displayAddress: shortAddr(m.address),
      level: m.level,
      stakeUsd: stakeByMember[m.address] ?? 0,
      orderCount: countByMember[m.address] ?? 0,
    }));

    const teamStakeUsd = team.reduce((s, m) => s + m.stakeUsd, 0);

    // ── Level ──
    const autoLevel = calculateLevel(teamStakeUsd, DEFAULT_LEVEL_THRESHOLDS);
    const manualLevel = user.levelOverride;
    const effectiveLevel = manualLevel ?? autoLevel;

    return NextResponse.json({
      uid: user.uid,
      address: user.walletAddress,
      displayAddress: shortAddr(user.walletAddress),
      accountLabel: `UID ${user.uid}`,
      inviteCode: user.inviteCode,
      registeredAt: formatDatetime(user.createdAt),
      registeredAtMs: user.createdAt.getTime(),
      referrer: user.referrer?.walletAddress ?? "",
      referrerDisplay: user.referrer ? shortAddr(user.referrer.walletAddress) : "无",
      directCount: user._count.referrals,
      teamCount: team.length,
      teamStakeUsd,
      totalStakedUsd,
      totalRedeemedUsd,
      totalClaimedUsd: personalClaimedUsd + teamClaimedUsd,
      totalPendingUsd: personalPendingUsd + teamPendingUsd,
      personalClaimedUsd,
      personalPendingUsd,
      teamClaimedUsd,
      teamPendingUsd,
      teamRewardUsd,
      autoLevel,
      manualLevel,
      effectiveLevel,
      orderCount: orders.length,
      activeOrderCount: orders.filter((o) => o.status === "进行中").length,
      completedOrderCount: orders.filter((o) => o.status === "已完成").length,
      orders,
      team,
    });
  } catch (error) {
    console.error("GET /api/users/[wallet] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
