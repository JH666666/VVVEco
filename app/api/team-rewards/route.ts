import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/team-rewards?beneficiary=0x...&claimed=false
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const beneficiary = (searchParams.get("beneficiary") ?? "").trim().toLowerCase();
    const sourceAddr = (searchParams.get("source") ?? "").trim().toLowerCase();
    const claimed = searchParams.get("claimed");
    const summary = searchParams.get("summary") === "1";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

    // 聚合模式：数据库直接按上级求总额 + 按下级分组求和，前端不再拉全部明细。
    // O(1) 次请求，无论记录多少都毫秒级；数值实时由明细算出（不缓存，绝不漂移）。
    if (summary && beneficiary) {
      const [grouped, pendingAgg, claimedAgg] = await Promise.all([
        prisma.teamReward.groupBy({
          by: ["sourceAddr"],
          where: { beneficiaryAddr: beneficiary },
          _sum: { amount: true },
        }),
        prisma.teamReward.aggregate({
          where: { beneficiaryAddr: beneficiary, claimed: false },
          _sum: { amount: true },
        }),
        prisma.teamReward.aggregate({
          where: { beneficiaryAddr: beneficiary, claimed: true },
          _sum: { amount: true },
        }),
      ]);
      const bySource: Record<string, number> = {};
      let total = 0;
      for (const g of grouped) {
        const amt = g._sum.amount ?? 0;
        bySource[g.sourceAddr] = amt;
        total += amt;
      }
      return NextResponse.json({
        summary: {
          total,
          pendingVvv: pendingAgg._sum.amount ?? 0,
          claimedVvv: claimedAgg._sum.amount ?? 0,
          bySource,
        },
      });
    }

    const where: Record<string, unknown> = {};
    if (beneficiary) where.beneficiaryAddr = beneficiary;
    if (sourceAddr) where.sourceAddr = sourceAddr;
    if (claimed === "true") where.claimed = true;
    if (claimed === "false") where.claimed = false;

    const [rewards, total] = await Promise.all([
      prisma.teamReward.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sourceUser: { select: { walletAddress: true, uid: true, inviteCode: true } },
          sourceOrder: { select: { txHash: true, mode: true, usdValue: true } },
        },
      }),
      prisma.teamReward.count({ where }),
    ]);

    const items = rewards.map((r) => ({
      id: String(r.id),
      claimTxHash: r.claimTxHash,
      beneficiaryAddr: r.beneficiaryAddr,
      rewardType: r.rewardType,
      generation: r.generation,
      rate: r.rate,
      amount: r.amount,
      claimed: r.claimed,
      claimedAt: r.claimedAt,
      createdAt: r.createdAt,
      source: {
        walletAddress: r.sourceUser.walletAddress,
        uid: r.sourceUser.uid,
        inviteCode: r.sourceUser.inviteCode,
      },
      sourceOrder: {
        txHash: r.sourceOrder.txHash,
        mode: r.sourceOrder.mode,
        usdValue: r.sourceOrder.usdValue,
      },
    }));

    // Aggregate totals
    const pendingVvv = await prisma.teamReward.aggregate({
      where: { ...where, claimed: false },
      _sum: { amount: true },
    });
    const claimedVvv = await prisma.teamReward.aggregate({
      where: { ...where, claimed: true },
      _sum: { amount: true },
    });

    return NextResponse.json({
      items,
      totals: {
        pendingVvv: pendingVvv._sum.amount ?? 0,
        claimedVvv: claimedVvv._sum.amount ?? 0,
      },
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("GET /api/team-rewards error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/team-rewards — create via chain event index
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const claimTxHash = (body.claimTxHash ?? "").trim();
    const beneficiaryAddr = (body.beneficiaryAddr ?? "").trim().toLowerCase();
    const sourceAddr = (body.sourceAddr ?? "").trim().toLowerCase();
    const sourceOrderTx = (body.sourceOrderTx ?? "").trim();

    if (!claimTxHash || !beneficiaryAddr || !sourceAddr || !sourceOrderTx) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const reward = await prisma.teamReward.create({
      data: {
        claimTxHash,
        beneficiaryAddr,
        sourceAddr,
        sourceOrderTx,
        rewardType: body.rewardType ?? "generation",
        generation: body.generation ?? null,
        rate: body.rate ?? 0,
        amount: body.amount ?? 0,
      },
    });

    const { id: _, ...rest } = reward as Record<string, unknown>
    return NextResponse.json({ id: String(reward.id), ...rest })
  } catch (error) {
    console.error("POST /api/team-rewards error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
