import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/admin/freeze-list — all freeze statuses
export async function GET() {
  try {
    const items = await prisma.userFreezeStatus.findMany({
      include: { user: { select: { uid: true } } },
    });
    return NextResponse.json({
      items: items.map(i => ({ ...i, uid: i.user?.uid ?? null })),
    });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
