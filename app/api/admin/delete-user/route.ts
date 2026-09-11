import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/delete-user — 安全删除"空壳"用户（仅管理员）。
 * 仅当该地址：无质押订单、无领取记录、无团队奖励（作为受益人或来源）、无下级（没人以它为上级）
 * 时才删除；否则拒绝，避免误删有真实数据的用户。
 * 用于清理通过开放注册接口灌入的伪造地址。
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const walletAddress = (body.walletAddress ?? "").trim().toLowerCase();
    if (!walletAddress || !/^0x[a-f0-9]{40}$/i.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 安全检查：任何真实活动都拒绝删除
    const [orders, claims, rewardsBenef, rewardsSource, children] = await Promise.all([
      prisma.stakeOrder.count({ where: { walletAddress } }),
      prisma.claimRecord.count({ where: { walletAddress } }),
      prisma.teamReward.count({ where: { beneficiaryAddr: walletAddress } }),
      prisma.teamReward.count({ where: { sourceAddr: walletAddress } }),
      prisma.user.count({ where: { referrerAddress: walletAddress } }),
    ]);

    if (orders > 0 || claims > 0 || rewardsBenef > 0 || rewardsSource > 0 || children > 0) {
      return NextResponse.json(
        {
          error: "该用户有真实数据，拒绝删除",
          detail: { orders, claims, teamRewardsAsBeneficiary: rewardsBenef, teamRewardsAsSource: rewardsSource, downlines: children },
        },
        { status: 409 }
      );
    }

    // 清理并删除（空壳，安全）
    await prisma.inviteRelation.deleteMany({
      where: { OR: [{ childAddress: walletAddress }, { parentAddress: walletAddress }] },
    });
    await prisma.userFreezeStatus.deleteMany({ where: { walletAddress } });
    await prisma.user.delete({ where: { walletAddress } });

    console.log(`[delete-user] removed empty user ${walletAddress} (uid=${user.uid})`);
    return NextResponse.json({ ok: true, walletAddress, uid: user.uid });
  } catch (error) {
    console.error("POST /api/admin/delete-user error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
