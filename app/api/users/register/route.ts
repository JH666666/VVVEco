import { prisma } from "@/lib/prisma";
import { getRootReferrerAddress } from "@/lib/get-root-referrer";
import { NextRequest, NextResponse } from "next/server";

const CHAR_SET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 8 }, () =>
      CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)]
    ).join("");
    // ensure at least 1 letter and 1 digit
  } while (!/[A-Z]/.test(code) || !/\d/.test(code));
  return code;
}

async function getNextUid(): Promise<number> {
  const lastUser = await prisma.user.findFirst({
    orderBy: { uid: "desc" },
    select: { uid: true },
  });
  return lastUser ? lastUser.uid + 1 : 100001;
}

// POST /api/users/register
// Body: { walletAddress: string, referrerCode?: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = (body.walletAddress ?? "").trim().toLowerCase();
    const referrerCode = (body.referrerCode ?? "").trim();

    if (!walletAddress || !/^0x[a-f0-9]{40}$/i.test(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    // check existing
    const existing = await prisma.user.findUnique({
      where: { walletAddress },
      include: { referrer: { select: { walletAddress: true, inviteCode: true } } },
    });

    if (existing) {
      return NextResponse.json({
        walletAddress: existing.walletAddress,
        uid: existing.uid,
        inviteCode: existing.inviteCode,
        referrer: existing.referrer ?? null,
        alreadyExists: true,
      });
    }

    // resolve referrer
    let referrerAddress: string | null = null;
    if (referrerCode) {
      // 有邀请码 → 查对应用户
      const referrer = await prisma.user.findFirst({
        where: {
          OR: [
            { inviteCode: referrerCode.toUpperCase() },
            { walletAddress: referrerCode.toLowerCase() },
          ],
        },
      });
      if (referrer && referrer.walletAddress !== walletAddress) {
        referrerAddress = referrer.walletAddress;
      }
    }

    if (!referrerAddress) {
      // 无邀请码（或邀请码无效）→ 绑定到项目方根地址
      const rootAddr = await getRootReferrerAddress();
      if (rootAddr && rootAddr !== walletAddress) {
        // 确保根用户存在（幂等 upsert，不影响已有数据）
        await prisma.user.upsert({
          where: { walletAddress: rootAddr },
          update: {},
          create: {
            walletAddress: rootAddr,
            uid: 100000,
            inviteCode: "VVVROOT00",
            referrerAddress: null,
          },
        });
        referrerAddress = rootAddr;
      }
    }

    const uid = await getNextUid();

    // inviteCode 不在注册时生成，首次质押成功后由 stake-orders API 生成
    const user = await prisma.user.create({
      data: {
        walletAddress,
        uid,
        referrerAddress,
      },
      include: {
        referrer: { select: { walletAddress: true, inviteCode: true } },
      },
    });

    // create invite relation if referrer exists
    if (referrerAddress) {
      const rootAddr = await getRootReferrerAddress();
      const boundMethod =
        referrerAddress === rootAddr && !referrerCode
          ? "auto_root"   // 无邀请码 → 自动归属根地址
          : "code_input"; // 有邀请码 → 正常邀请
      await prisma.inviteRelation.create({
        data: {
          childAddress: walletAddress,
          parentAddress: referrerAddress,
          boundMethod,
        },
      });
    }

    return NextResponse.json({
      walletAddress: user.walletAddress,
      uid: user.uid,
      inviteCode: user.inviteCode,
      referrer: user.referrer ?? null,
      alreadyExists: false,
    });
  } catch (error) {
    console.error("POST /api/users/register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
