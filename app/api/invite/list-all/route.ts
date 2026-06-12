import { prisma } from "@/lib/prisma";
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

// GET /api/invite/list-all?q=&dateFrom=&dateTo=&page=1&pageSize=20
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q        = (searchParams.get("q") ?? searchParams.get("wallet") ?? "").trim();
    const dateFrom = searchParams.get("dateFrom") ?? "";
    const dateTo   = searchParams.get("dateTo") ?? "";
    const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

    const where: Record<string, unknown> = {};
    if (q) {
      const wallet = await resolveWallet(q);
      if (wallet) {
        where.OR = [{ childAddress: wallet }, { parentAddress: wallet }];
      } else {
        where.childAddress = "__no_match__";
      }
    }
    if (dateFrom || dateTo) {
      where.boundAt = {
        ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
        ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59.999Z`) }   : {}),
      };
    }

    const [relations, total] = await Promise.all([
      prisma.inviteRelation.findMany({
        where,
        orderBy: { boundAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          child:  { select: { inviteCode: true } },
          parent: { select: { inviteCode: true } },
        },
      }),
      prisma.inviteRelation.count({ where }),
    ]);

    const items = relations.map(r => ({
      childAddress:    r.childAddress,
      parentAddress:   r.parentAddress,
      boundMethod:     r.boundMethod,
      createdAt:       r.boundAt,
      childInviteCode:  r.child?.inviteCode  ?? null,
      parentInviteCode: r.parent?.inviteCode ?? null,
    }));

    return NextResponse.json({
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("GET /api/invite/list-all error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
