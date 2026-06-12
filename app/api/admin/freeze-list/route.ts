import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/admin/freeze-list — all freeze statuses
export async function GET() {
  try {
    const items = await prisma.userFreezeStatus.findMany();
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
