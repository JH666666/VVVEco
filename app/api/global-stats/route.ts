import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/global-stats
export async function GET() {
  try {
    let config = await prisma.globalStatsConfig.findFirst({ where: { id: 1 } });
    if (!config) {
      config = await prisma.globalStatsConfig.create({ data: { id: 1 } });
    }

    const realStaked = await prisma.stakeOrder.aggregate({ _sum: { usdValue: true } });
    const realStakers = await prisma.user.count({ where: { stakeOrders: { some: {} } } });
    const realClaimed = await prisma.claimRecord.aggregate({ _sum: { amountUsd: true } });

    const activeOrders = await prisma.stakeOrder.findMany({
      where: { isWithdrawn: false },
      include: { claimRecords: { select: { amountUsd: true } } },
    });
    const now = Date.now();
    const realPendingUsd = activeOrders.reduce((sum, order) => {
      const elapsedMs = Math.max(0, now - order.startTime.getTime());
      const unitMs = order.periodUnit === "hour" ? 3_600_000 : 86_400_000;
      const totalMs = order.period * unitMs;
      const elapsedUnits = Math.min(elapsedMs, totalMs) / unitMs;
      const rewardPerUnit = (order.dailyRate / 100) * order.usdValue;
      const accrued = rewardPerUnit * elapsedUnits;
      const claimed = order.claimRecords.reduce((s, r) => s + r.amountUsd, 0);
      return sum + Math.max(0, accrued - claimed);
    }, 0);

    return NextResponse.json({
      real: {
        stakedUsd: realStaked._sum.usdValue ?? 0,
        claimedUsd: realClaimed._sum.amountUsd ?? 0,
        stakerCount: realStakers,
        pendingUsd: realPendingUsd,
      },
      config,
    });
  } catch {
    return NextResponse.json({
      real: { stakedUsd: 0, claimedUsd: 0, stakerCount: 0, pendingUsd: 0 },
    });
  }
}

// PUT /api/global-stats — admin update config
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const data: Record<string, number> = {};
    if (typeof body.baseStakedUsd === "number") data.baseStakedUsd = body.baseStakedUsd;
    if (typeof body.baseClaimedUsd === "number") data.baseClaimedUsd = body.baseClaimedUsd;
    if (typeof body.baseStakers === "number") data.baseStakers = Math.round(body.baseStakers);
    if (typeof body.stakedMinPerEvent === "number") data.stakedMinPerEvent = body.stakedMinPerEvent;
    if (typeof body.stakedMaxPerEvent === "number") data.stakedMaxPerEvent = body.stakedMaxPerEvent;
    if (typeof body.claimedMinPerEvent === "number") data.claimedMinPerEvent = body.claimedMinPerEvent;
    if (typeof body.claimedMaxPerEvent === "number") data.claimedMaxPerEvent = body.claimedMaxPerEvent;
    if (typeof body.stakersMinPerEvent === "number") data.stakersMinPerEvent = Math.round(body.stakersMinPerEvent);
    if (typeof body.stakersMaxPerEvent === "number") data.stakersMaxPerEvent = Math.round(body.stakersMaxPerEvent);
    if (typeof body.eventsPerHour === "number") data.eventsPerHour = body.eventsPerHour;

    const config = await prisma.globalStatsConfig.upsert({
      where: { id: 1 },
      update: { ...data, updatedAt: new Date() },
      create: { id: 1, ...data },
    });

    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
