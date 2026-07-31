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
        where: { walletAddress: { in: addresses }, isWithdrawn: false },
        select: { walletAddress: true, usdValue: true, endTime: true, hiddenByAdmin: true },
      }),
      prisma.user.findMany({
        where: { walletAddress: { in: addresses } },
        select: { walletAddress: true, uid: true, inviteCode: true, createdAt: true },
      }),
    ]);

    const now = Date.now();
    // 两套口径：
    // stakeByAccount     —— 有效质押（排除后台隐藏），用于团队矩阵每个成员节点显示的质押金额
    // stakeFullByAccount —— 完整质押（含隐藏），用于团队页顶部「团队质押」聚合与等级计算（不因隐藏而变）
    const stakeByAccount: Record<string, number> = {};
    const stakeFullByAccount: Record<string, number> = {};
    for (const order of orders) {
      if (order.endTime.getTime() > now) {
        stakeFullByAccount[order.walletAddress] = (stakeFullByAccount[order.walletAddress] ?? 0) + order.usdValue;
        if (!order.hiddenByAdmin) {
          stakeByAccount[order.walletAddress] = (stakeByAccount[order.walletAddress] ?? 0) + order.usdValue;
        }
      }
    }

    const usersOut = users.map(u => ({
      walletAddress: u.walletAddress,
      uid: u.uid,
      inviteCode: u.inviteCode,
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json({ referrals, stakeByAccount, stakeFullByAccount, users: usersOut });
  } catch (error) {
    console.error("GET /api/team-tree error:", error);
    return NextResponse.json({ referrals: {}, stakeByAccount: {}, users: [] }, { status: 500 });
  }
}
