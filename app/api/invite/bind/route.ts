import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// POST /api/invite/bind
// Body: { childAddress: string, parentCode: string, method?: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const childAddress = (body.childAddress ?? "").trim().toLowerCase();
    const parentCode = (body.parentCode ?? "").trim();
    const method = body.method ?? "code_input";

    if (!childAddress || !/^0x[a-f0-9]{40}$/i.test(childAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    if (!parentCode) {
      return NextResponse.json(
        { error: "Missing parent code or address" },
        { status: 400 }
      );
    }

    // resolve parent
    const parent = await prisma.user.findFirst({
      where: {
        OR: [
          { inviteCode: parentCode.toUpperCase() },
          { walletAddress: parentCode.toLowerCase() },
        ],
      },
    });

    if (!parent) {
      return NextResponse.json(
        { error: "Parent not found" },
        { status: 404 }
      );
    }

    if (parent.walletAddress === childAddress) {
      return NextResponse.json(
        { error: "Cannot refer yourself" },
        { status: 400 }
      );
    }

    // ensure child exists — auto-create if missing (no invite code assigned yet)
    const existingChild = await prisma.user.findUnique({
      where: { walletAddress: childAddress },
    });

    if (!existingChild) {
      const lastUser = await prisma.user.findFirst({
        orderBy: { uid: "desc" },
        select: { uid: true },
      });
      const uid = lastUser ? lastUser.uid + 1 : 100001;
      await prisma.user.create({
        data: { walletAddress: childAddress, uid },
      });
    }

    // check existing invite relation
    const existingRelation = await prisma.inviteRelation.findUnique({
      where: { childAddress },
    });

    // 只有非 auto_root 的绑定才视为已绑定，不允许覆盖
    if (existingRelation && existingRelation.boundMethod !== 'auto_root') {
      return NextResponse.json({
        childAddress: existingRelation.childAddress,
        parentAddress: existingRelation.parentAddress,
        boundMethod: existingRelation.boundMethod,
        alreadyBound: true,
      });
    }

    // auto_root 可被真实邀请码覆盖；upsert 保证幂等
    const [relation] = await prisma.$transaction([
      prisma.inviteRelation.upsert({
        where: { childAddress },
        update: {
          parentAddress: parent.walletAddress,
          boundMethod: method,
        },
        create: {
          childAddress,
          parentAddress: parent.walletAddress,
          boundMethod: method,
        },
      }),
      prisma.user.update({
        where: { walletAddress: childAddress },
        data: { referrerAddress: parent.walletAddress },
      }),
    ]);

    return NextResponse.json({
      childAddress: relation.childAddress,
      parentAddress: relation.parentAddress,
      boundMethod: relation.boundMethod,
      alreadyBound: false,
    });
  } catch (error) {
    console.error("POST /api/invite/bind error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
