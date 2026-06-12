import { prisma } from "@/lib/prisma";
import { invalidateRootReferrerCache } from "@/lib/get-root-referrer";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/contract-config
export async function GET() {
  try {
    let config = await prisma.contractConfig.findFirst({ where: { id: 1 } });
    if (!config) config = await prisma.contractConfig.create({ data: { id: 1 } });
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 500 });
  }
}

// PUT /api/admin/contract-config
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = ["stakingContract", "payoutContract", "vvvToken", "priceRouter", "projectWallet", "feeWallet", "feePercent", "rootReferrerAddress"];
    for (const f of fields) if (body[f] !== undefined) data[f] = body[f];

    const config = await prisma.contractConfig.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });

    // 如果 rootReferrerAddress 被更新，使服务端缓存失效
    if (body.rootReferrerAddress !== undefined) {
      invalidateRootReferrerCache();
    }

    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
