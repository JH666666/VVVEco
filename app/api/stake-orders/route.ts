import { prisma } from "@/lib/prisma";
import { verifyStakeTx } from "@/lib/verify-tx";
import { getLatestChainOrder } from "@/lib/chain-read";
import { NextRequest, NextResponse } from "next/server";

const CHAR_SET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function generateUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    let code = "";
    do {
      code = Array.from({ length: 8 }, () =>
        CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)]
      ).join("");
    } while (!/[A-Z]/.test(code) || !/\d/.test(code));
    const exists = await prisma.user.findUnique({ where: { inviteCode: code }, select: { walletAddress: true } });
    if (!exists) return code;
  }
  // 极端兜底：加时间戳后缀
  return `V${Date.now().toString(36).toUpperCase().slice(-7)}`;
}

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

// GET /api/stake-orders?q=&status=&dateFrom=&dateTo=&minUsd=&maxUsd=
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q        = (searchParams.get("q") ?? searchParams.get("wallet") ?? "").trim();
    const status   = searchParams.get("status") ?? "all";
    const dateFrom = searchParams.get("dateFrom") ?? "";
    const dateTo   = searchParams.get("dateTo") ?? "";
    const minUsd   = parseFloat(searchParams.get("minUsd") ?? "");
    const maxUsd   = parseFloat(searchParams.get("maxUsd") ?? "");
    const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

    const includeHidden = searchParams.get("includeHidden") === "true";
    const where: Record<string, unknown> = {};
    if (!includeHidden) where.hiddenByAdmin = false;
    if (q) {
      // 64-char hex → direct txHash lookup (bypasses sort/pagination issues)
      if (/^0x[a-f0-9]{64}$/i.test(q)) {
        where.txHash = q.toLowerCase();
      } else {
        const wallet = await resolveWallet(q);
        if (wallet) where.walletAddress = wallet;
        else where.walletAddress = "__no_match__";
      }
    }
    if (status === "active") where.isWithdrawn = false;
    if (status === "completed") where.isWithdrawn = true;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
        ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59.999Z`) }   : {}),
      };
    }
    if (!isNaN(minUsd) || !isNaN(maxUsd)) {
      where.usdValue = {
        ...(!isNaN(minUsd) ? { gte: minUsd } : {}),
        ...(!isNaN(maxUsd) ? { lte: maxUsd } : {}),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.stakeOrder.findMany({
        where,
        orderBy: { startTime: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { walletAddress: true, uid: true, inviteCode: true } },
          claimRecords: { select: { amount: true, amountVvv: true, amountUsd: true } },
        },
      }),
      prisma.stakeOrder.count({ where }),
    ]);

    const items = orders.map((o) => {
      const claimedVvv = o.claimRecords.reduce((s, c) => s + c.amountVvv, 0);
      const claimedUsd = o.claimRecords.reduce((s, c) => s + c.amountUsd, 0);
      const now = Date.now();
      const elapsedMs = Math.max(0, now - o.startTime.getTime());
      const unitMs = o.periodUnit === "hour" ? 3600000 : 86400000;
      const periodMs = o.period * unitMs;
      const periodReward = o.mode === "coin"
        ? o.amount * (o.dailyRate / 100)
        : o.usdValue * (o.dailyRate / 100);
      const totalExpected = periodReward * o.period;
      const accrued = Math.min(totalExpected, periodReward * Math.min(1, elapsedMs / unitMs));
      const pending = Math.max(0, accrued - (o.mode === "coin" ? claimedVvv : claimedUsd));

      return {
        txHash: o.txHash,
        walletAddress: o.walletAddress,
        uid: o.user.uid,
        mode: o.mode,
        amount: o.amount,
        usdValue: o.usdValue,
        period: o.period,
        periodUnit: o.periodUnit,
        dailyRate: o.dailyRate,
        startTime: o.startTime,
        endTime: o.endTime,
        isWithdrawn: o.isWithdrawn,
        hiddenByAdmin: o.hiddenByAdmin,
        claimedVvv,
        claimedUsd,
        pending,
        totalExpected,
        progressPercent: Math.min(100, Math.max(0, (elapsedMs / periodMs) * 100)),
        status: elapsedMs >= periodMs ? "completed" : (o.isWithdrawn ? "completed" : "active"),
      };
    });

    return NextResponse.json({
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("GET /api/stake-orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/stake-orders — create via chain event index
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = (body.walletAddress ?? "").trim().toLowerCase();
    const txHash = (body.txHash ?? "").trim();

    if (!walletAddress || !txHash) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify on-chain tx (fail-open if RPC unavailable)
    const verification = await verifyStakeTx(txHash, walletAddress);
    if (!verification.ok) {
      console.error("[POST /api/stake-orders] tx verification failed:", verification.reason);
      return NextResponse.json({ error: "Transaction verification failed", detail: verification.reason }, { status: 403 });
    }

    // 从链上读取权威订单数据，覆盖前端计算的 usdValue/amount/rate
    const chainOrder = await getLatestChainOrder(walletAddress);
    const amount    = chainOrder ? chainOrder.vvvAmountIn  : (body.amount ?? 0);
    const usdValue  = chainOrder ? chainOrder.usdValue     : (body.usdValue ?? 0);
    const dailyRate = chainOrder ? chainOrder.dailyRatePct : (body.dailyRate ?? 0.9);
    const mode      = chainOrder ? (chainOrder.isCoinBased ? "coin" : "fiat") : (body.mode ?? "coin");
    const period    = chainOrder ? chainOrder.duration     : (body.period ?? 30);
    const startTime = chainOrder ? chainOrder.startTime    : (body.startTime ? new Date(body.startTime) : new Date());
    const endTime   = chainOrder ? chainOrder.endTime      : (body.endTime ? new Date(body.endTime) : new Date());

    if (!chainOrder) {
      console.warn("[POST /api/stake-orders] chain read failed, falling back to body values for", txHash);
    }

    // Upsert: don't duplicate
    const order = await prisma.stakeOrder.upsert({
      where: { txHash },
      update: { amount, usdValue, dailyRate, mode, period, startTime, endTime },
      create: {
        txHash,
        walletAddress,
        mode,
        amount,
        usdValue,
        period,
        periodUnit: body.periodUnit ?? "day",
        dailyRate,
        startTime,
        endTime,
      },
    });

    // 首次质押成功后生成邀请码（如果还没有）
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      select: { inviteCode: true },
    });
    if (user && !user.inviteCode) {
      const inviteCode = await generateUniqueInviteCode();
      await prisma.user.update({ where: { walletAddress }, data: { inviteCode } });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("POST /api/stake-orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { txHash, withdrawnTx } = body;
    if (!txHash) return NextResponse.json({ error: "txHash required" }, { status: 400 });
    const order = await prisma.stakeOrder.update({
      where: { txHash },
      data: { isWithdrawn: true, withdrawnTx: withdrawnTx ?? null },
    });
    return NextResponse.json(order);
  } catch (error) {
    console.error("PATCH /api/stake-orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
