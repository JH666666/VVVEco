import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

// PUT /api/admin/freeze — freeze/unfreeze user operations
export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const target = (body.targetAddress ?? "").trim().toLowerCase();
    const admin = (body.adminAddress ?? "admin").trim().toLowerCase();

    if (!target || !/^0x[a-f0-9]{40}$/i.test(target)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const data: Record<string, boolean | Date> = {};
    if (typeof body.personalClaim === "boolean") data.personalClaimFrozen = body.personalClaim;
    if (typeof body.teamClaim === "boolean") data.teamClaimFrozen = body.teamClaim;
    if (typeof body.principalWithdraw === "boolean") data.principalWithdrawFrozen = body.principalWithdraw;

    const isFreezing = body.personalClaim === true || body.teamClaim === true || body.principalWithdraw === true;
    const isUnfreezing = body.personalClaim === false || body.teamClaim === false || body.principalWithdraw === false;
    if (isFreezing) data.frozenAt = new Date();
    if (isUnfreezing) data.unfrozenAt = new Date();

    // Upsert freeze status
    const status = await prisma.userFreezeStatus.upsert({
      where: { walletAddress: target },
      update: { ...data, updatedAt: new Date() },
      create: { walletAddress: target, ...data },
    });

    // Audit log
    const actions = [];
    if (typeof body.personalClaim === "boolean") actions.push(`personal_claim:${body.personalClaim}`);
    if (typeof body.teamClaim === "boolean") actions.push(`team_claim:${body.teamClaim}`);
    if (typeof body.principalWithdraw === "boolean") actions.push(`principal_withdraw:${body.principalWithdraw}`);

    await prisma.adminAuditLog.create({
      data: {
        adminAddress: admin,
        targetAddress: target,
        actionType: body.personalClaim === false || body.teamClaim === false || body.principalWithdraw === false
          ? "unfreeze" : "freeze",
        actionValue: actions.join(","),
      },
    });

    return NextResponse.json(status);
  } catch (e) {
    console.error("PUT /api/admin/freeze error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/admin/freeze?target=0x...
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = (searchParams.get("target") ?? "").trim().toLowerCase();
  if (!target) return NextResponse.json({ error: "Missing target" }, { status: 400 });

  const status = await prisma.userFreezeStatus.findUnique({ where: { walletAddress: target } });
  return NextResponse.json(status ?? {
    walletAddress: target,
    personalClaimFrozen: false,
    teamClaimFrozen: false,
    principalWithdrawFrozen: false,
  });
}
