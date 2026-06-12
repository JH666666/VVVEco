import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// POST /api/team-rewards/claim
// Mark team rewards as claimed for a beneficiary
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const beneficiaryAddr = (body.beneficiaryAddr ?? "").trim().toLowerCase();

    if (!beneficiaryAddr) {
      return NextResponse.json({ error: "Missing beneficiaryAddr" }, { status: 400 });
    }

    // Find all unclaimed rewards for this beneficiary
    const unclaimed = await prisma.teamReward.findMany({
      where: { beneficiaryAddr, claimed: false },
      select: { id: true, amount: true },
    });

    if (unclaimed.length === 0) {
      return NextResponse.json({ itemsClaimed: 0, totalVvv: 0 });
    }

    const claimedAt = new Date();
    const totalVvv = unclaimed.reduce((s, r) => s + r.amount, 0);

    // Mark all as claimed
    await prisma.teamReward.updateMany({
      where: { beneficiaryAddr, claimed: false },
      data: { claimed: true, claimedAt },
    });

    return NextResponse.json({
      itemsClaimed: unclaimed.length,
      totalVvv,
      claimedAt,
    });
  } catch (error) {
    console.error("POST /api/team-rewards/claim error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
