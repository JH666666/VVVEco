import { prisma } from "@/lib/prisma";
import { repairTeamRewardByTxHash } from "@/lib/missing-team-rewards";
import { NextRequest, NextResponse } from "next/server";

async function resolveWallet(q: string): Promise<string | null> {
  if (!q) return null;
  if (/^0x[a-f0-9]{40}$/i.test(q)) return q.toLowerCase();
  const uidNum = parseInt(q, 10);
  if (!isNaN(uidNum) && String(uidNum) === q) {
    const u = await prisma.user.findFirst({ where: { uid: uidNum }, select: { walletAddress: true } });
    return u?.walletAddress ?? null;
  }
  const u = await prisma.user.findFirst({ where: { inviteCode: q.toUpperCase() }, select: { walletAddress: true } });
  return u?.walletAddress ?? null;
}

// GET /api/claims?q=&dateFrom=&dateTo=&minUsd=&maxUsd=
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q           = (searchParams.get("q") ?? searchParams.get("wallet") ?? "").trim();
    const orderTxHash = (searchParams.get("orderTxHash") ?? "").trim();
    const dateFrom    = searchParams.get("dateFrom") ?? "";
    const dateTo      = searchParams.get("dateTo") ?? "";
    const minUsd      = parseFloat(searchParams.get("minUsd") ?? "");
    const maxUsd      = parseFloat(searchParams.get("maxUsd") ?? "");
    const page        = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize    = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

    const where: Record<string, unknown> = {};
    if (q) {
      const wallet = await resolveWallet(q);
      if (wallet) where.walletAddress = wallet;
      else where.walletAddress = "__no_match__";
    }
    if (orderTxHash) where.orderTxHash = orderTxHash;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
        ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59.999Z`) }   : {}),
      };
    }
    if (!isNaN(minUsd) || !isNaN(maxUsd)) {
      where.amountUsd = {
        ...(!isNaN(minUsd) ? { gte: minUsd } : {}),
        ...(!isNaN(maxUsd) ? { lte: maxUsd } : {}),
      };
    }

    const [claims, total] = await Promise.all([
      prisma.claimRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { walletAddress: true, uid: true } },
          order: { select: { mode: true, dailyRate: true } },
        },
      }),
      prisma.claimRecord.count({ where }),
    ]);

    const items = claims.map((c) => ({
      txHash: c.txHash,
      orderTxHash: c.orderTxHash,
      walletAddress: c.walletAddress,
      uid: c.user.uid,
      amount: c.amount,
      amountVvv: c.amountVvv,
      amountUsd: c.amountUsd,
      priceAtClaim: c.priceAtClaim,
      feeAmount: c.feeAmount,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("GET /api/claims error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/claims — create via chain event index
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const txHash = (body.txHash ?? "").trim();
    const orderTxHash = (body.orderTxHash ?? "").trim();
    const walletAddress = (body.walletAddress ?? "").trim().toLowerCase();

    if (!txHash || !orderTxHash || !walletAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify order exists
    const order = await prisma.stakeOrder.findUnique({ where: { txHash: orderTxHash } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const claim = await prisma.claimRecord.upsert({
      where: { txHash },
      update: {},
      create: {
        txHash,
        orderTxHash,
        walletAddress,
        amount: body.amount ?? 0,
        amountVvv: body.amountVvv ?? 0,
        amountUsd: body.amountUsd ?? 0,
        priceAtClaim: body.priceAtClaim ?? 0.25,
        feeAmount: body.feeAmount ?? 0,
      },
    });

    // 自愈：领取时把这笔交易里派发给上级的推荐/团队奖励从链上读出并补录入库。
    // 服务端读回执解析 TeamRewardAccrued（按笔数去重，不会与前端上报重复计），
    // 即使前端上报团队奖励那一步失败，也能在领取入库时自动补齐。
    // 后台执行、不阻断领取入库的响应（pm2 常驻进程会跑完）。
    repairTeamRewardByTxHash(txHash)
      .then((r) => {
        if (r.repaired > 0) console.log(`[claims] auto-backfilled ${r.repaired} team reward(s) from claim ${txHash}`);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        // "该交易未找到 TeamRewardAccrued 事件" 属正常（无上级/无奖励），忽略
        if (!msg.includes("TeamRewardAccrued")) console.warn(`[claims] team reward auto-backfill skipped for ${txHash}:`, msg);
      });

    return NextResponse.json(claim);
  } catch (error) {
    console.error("POST /api/claims error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
