import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/invite/list?wallet=0x...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = (searchParams.get("wallet") ?? "").trim().toLowerCase();

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet param" }, { status: 400 });
    }

    // As child — who invited me
    const asChild = await prisma.inviteRelation.findUnique({
      where: { childAddress: wallet },
      include: { parent: { select: { walletAddress: true, inviteCode: true, uid: true } } },
    });

    // As parent — who I invited
    const asParent = await prisma.inviteRelation.findMany({
      where: { parentAddress: wallet },
      include: { child: { select: { walletAddress: true, inviteCode: true, uid: true } } },
    });

    return NextResponse.json({
      boundTo: asChild
        ? { parentAddress: asChild.parentAddress, boundMethod: asChild.boundMethod, boundAt: asChild.boundAt }
        : null,
      children: asParent.map((r) => ({
        walletAddress: r.child.walletAddress,
        inviteCode: r.child.inviteCode,
        uid: r.child.uid,
        boundMethod: r.boundMethod,
        boundAt: r.boundAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/invite/list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
