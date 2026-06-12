import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PUT /api/admin/hide-order — hide/show a stake order
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const txHash = (body.txHash ?? "").trim();
    const hidden = Boolean(body.hidden);
    const admin = (body.adminAddress ?? "admin").trim().toLowerCase();

    if (!txHash) {
      return NextResponse.json({ error: "Missing txHash" }, { status: 400 });
    }

    await prisma.stakeOrder.update({
      where: { txHash },
      data: { hiddenByAdmin: hidden },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminAddress: admin,
        targetAddress: txHash,
        actionType: hidden ? "hide_order" : "show_order",
        actionValue: JSON.stringify({ txHash, hidden }),
      },
    });

    return NextResponse.json({ txHash, hiddenByAdmin: hidden });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
