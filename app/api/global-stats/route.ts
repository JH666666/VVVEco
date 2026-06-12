import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/global-stats
export async function GET() {
  try {
    let config = await prisma.globalStatsConfig.findFirst({ where: { id: 1 } });
    if (!config) {
      config = await prisma.globalStatsConfig.create({ data: { id: 1 } });
    }

    // Real stats from DB
    const realStaked = await prisma.stakeOrder.aggregate({ _sum: { usdValue: true } });
    const realStakers = await prisma.user.count({ where: { stakeOrders: { some: {} } } });
    const realClaimed = await prisma.claimRecord.aggregate({ _sum: { amountUsd: true } });

    const elapsed = Math.max(0, (Date.now() - config.updatedAt.getTime()) / 3600000);
    const autoStaked = config.stakedGrowthUsdPerHour * elapsed;
    const autoClaimed = config.claimedGrowthUsdPerHour * elapsed;
    const autoStakers = Math.floor(config.stakersGrowthPerDay * (elapsed / 24));

    return NextResponse.json({
      display: {
        stakedUsd: config.baseStakedUsd + autoStaked + (realStaked._sum.usdValue ?? 0),
        claimedUsd: config.baseClaimedUsd + autoClaimed + (realClaimed._sum.amountUsd ?? 0),
        stakers: config.baseStakers + autoStakers + realStakers,
      },
      real: {
        stakedUsd: realStaked._sum.usdValue ?? 0,
        claimedUsd: realClaimed._sum.amountUsd ?? 0,
        stakerCount: realStakers,
      },
      config,
    });
  } catch {
    return NextResponse.json({
      display: { stakedUsd: 0, claimedUsd: 0, stakers: 0 },
      real: { stakedUsd: 0, claimedUsd: 0, stakerCount: 0 },
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
    if (typeof body.baseStakers === "number") data.baseStakers = body.baseStakers;
    if (typeof body.stakedGrowthUsdPerHour === "number") data.stakedGrowthUsdPerHour = body.stakedGrowthUsdPerHour;
    if (typeof body.claimedGrowthUsdPerHour === "number") data.claimedGrowthUsdPerHour = body.claimedGrowthUsdPerHour;
    if (typeof body.stakersGrowthPerDay === "number") data.stakersGrowthPerDay = body.stakersGrowthPerDay;

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
