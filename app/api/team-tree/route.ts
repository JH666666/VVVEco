import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/team-tree?wallet=0x...
// Returns downstream referral tree data (up to 7 levels) for given wallet
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = (searchParams.get("wallet") ?? "").trim().toLowerCase();

    if (!wallet) {
      return NextResponse.json({ referrals: {}, stakeByAccount: {}, users: [] });
    }

    // BFS: collect all downstream referrals up to 7 levels
    const referrals: Record<string, string> = {};
    const allAddresses = new Set<string>([wallet]);
    let frontier = [wallet];

    for (let level = 0; level < 7 && frontier.length > 0; level++) {
      const children = await prisma.user.findMany({
        where: { referrerAddress: { in: frontier } },
        select: { walletAddress: true, referrerAddress: true },
      });

      frontier = [];
      for (const child of children) {
        if (!allAddresses.has(child.walletAddress) && child.referrerAddress) {
          allAddresses.add(child.walletAddress);
          referrals[child.walletAddress] = child.referrerAddress;
          frontier.push(child.walletAddress);
        }
      }
    }

    const addresses = Array.from(allAddresses);

    const [orders, users] = await Promise.all([
      prisma.stakeOrder.findMany({
        where: { walletAddress: { in: addresses }, hiddenByAdmin: false, isWithdrawn: false },
        select: { walletAddress: true, usdValue: true, endTime: true },
      }),
      prisma.user.findMany({
        where: { walletAddress: { in: addresses } },
        select: { walletAddress: true, uid: true, inviteCode: true, createdAt: true },
      }),
    ]);

    const now = Date.now();
    const stakeByAccount: Record<string, number> = {};
    for (const order of orders) {
      if (order.endTime.getTime() > now) {
        stakeByAccount[order.walletAddress] = (stakeByAccount[order.walletAddress] ?? 0) + order.usdValue;
      }
    }

    const usersOut = users.map(u => ({
      walletAddress: u.walletAddress,
      uid: u.uid,
      inviteCode: u.inviteCode,
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json({ referrals, stakeByAccount, users: usersOut });
  } catch (error) {
    console.error("GET /api/team-tree error:", error);
    return NextResponse.json({ referrals: {}, stakeByAccount: {}, users: [] }, { status: 500 });
  }
}
