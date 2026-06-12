import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, encodeFunctionData, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";

const STAKING_ADDR = (process.env.NEXT_PUBLIC_VVECO_STAKING || "0xf1F2A60EdD2110a42F5Ec9d760348C0fB4Bc1659") as `0x${string}`;
const RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

// Read on-chain users[address].level (uint8 at slot index 2 of UserInfo struct)
async function getOnChainLevel(wallet: `0x${string}`): Promise<number> {
  try {
    const data = encodeFunctionData({
      abi: parseAbi(["function users(address) view returns (address referrer, uint256 teamVolume7, uint8 level, uint256 rewardClaimed)"]),
      functionName: "users",
      args: [wallet],
    });
    const result = await publicClient.call({ to: STAKING_ADDR, data });
    if (!result.data || result.data === "0x") return 1;
    // Decode: referrer(32) + teamVolume7(32) + level(32, but uint8) + rewardClaimed(32)
    const hex = result.data.slice(2); // remove 0x
    const levelHex = hex.slice(64 * 2, 64 * 3); // 3rd slot
    const level = parseInt(levelHex, 16);
    return level >= 1 && level <= 8 ? level : 1;
  } catch {
    return 1;
  }
}

// GET /api/admin/users?page=1&pageSize=10&q=&registeredStart=&registeredEnd=&minStake=&maxStake=
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "10", 10)));
    const registeredStart = searchParams.get("registeredStart") ?? "";
    const registeredEnd = searchParams.get("registeredEnd") ?? "";

    const where: Record<string, unknown> = {};

    if (q) {
      const uidNum = parseInt(q, 10);
      where.OR = [
        { walletAddress: { contains: q.toLowerCase() } },
        { inviteCode: { equals: q.toUpperCase() } },
      ];
      if (Number.isFinite(uidNum) && uidNum >= 100001) {
        (where.OR as unknown[]).push({ uid: uidNum });
      }
    }

    if (registeredStart) {
      where.createdAt = { ...(where.createdAt as object ?? {}), gte: new Date(`${registeredStart}T00:00:00.000Z`) };
    }
    if (registeredEnd) {
      where.createdAt = { ...(where.createdAt as object ?? {}), lte: new Date(`${registeredEnd}T23:59:59.999Z`) };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { uid: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          referrer: { select: { walletAddress: true } },
          stakeOrders: { include: { claimRecords: { select: { amountUsd: true } } } },
          _count: { select: { referrals: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Batch read on-chain levels in parallel
    const chainLevels = await Promise.all(
      users.map(u => getOnChainLevel(u.walletAddress as `0x${string}`))
    );

    const now = new Date();
    const items = users.map((user, i) => {
      const totalStakedUsd = user.stakeOrders.reduce((sum, o) => sum + o.usdValue, 0);
      const activeOrders = user.stakeOrders.filter((o) => !o.isWithdrawn && o.endTime > now);
      const totalRedeemedUsd = user.stakeOrders.filter((o) => o.isWithdrawn).reduce((sum, o) => sum + o.usdValue, 0);
      const chainLevel = chainLevels[i];

      // 已领取 = 所有 claim records 的 amountUsd 之和
      const totalClaimedUsd = user.stakeOrders.reduce(
        (sum, o) => sum + o.claimRecords.reduce((s, c) => s + c.amountUsd, 0),
        0
      );

      // 待领取 = 活跃订单的累计收益 - 已领取部分
      const totalPendingUsd = activeOrders.reduce((sum, o) => {
        const unitMs = o.periodUnit === "hour" ? 3600_000 : 86_400_000;
        const elapsedUnits = Math.max(0, (now.getTime() - o.startTime.getTime()) / unitMs);
        const periodReward = o.usdValue * (o.dailyRate / 100);
        const accrued = Math.min(periodReward * o.period, periodReward * elapsedUnits);
        const claimed = o.claimRecords.reduce((s, c) => s + c.amountUsd, 0);
        return sum + Math.max(0, accrued - claimed);
      }, 0);

      return {
        uid: user.uid,
        address: user.walletAddress,
        displayAddress: `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-6)}`,
        accountLabel: `UID ${user.uid}`,
        inviteCode: user.inviteCode,
        registeredAt: user.createdAt.toLocaleString("zh-CN", { hour12: false }),
        registeredAtMs: user.createdAt.getTime(),
        referrerDisplay: user.referrer
          ? `${user.referrer.walletAddress.slice(0, 6)}...${user.referrer.walletAddress.slice(-6)}`
          : "无",
        directCount: user._count.referrals,
        teamCount: user._count.referrals,
        totalStakedUsd,
        totalRedeemedUsd,
        totalClaimedUsd,
        totalPendingUsd,
        chainLevel,
        effectiveLevel: chainLevel,
        orderCount: user.stakeOrders.length,
        activeOrderCount: activeOrders.length,
      };
    });

    return NextResponse.json({
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
