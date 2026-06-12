import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/notifications
export async function GET() {
  try {
    const items = await prisma.notification.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

// POST /api/notifications — admin publish
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const notification = await prisma.notification.create({
      data: {
        type: body.type ?? "announcement",
        title: body.title ?? "",
        content: body.content ?? "",
        titleEn: body.titleEn ?? "",
        contentEn: body.contentEn ?? "",
        enabled: true,
      },
    });
    return NextResponse.json(notification);
  } catch {
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

// PUT /api/notifications — toggle/delete
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    if (body.enabled === false) {
      await prisma.notification.update({ where: { id }, data: { enabled: false } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// DELETE /api/notifications
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await prisma.notification.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
