import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  addToQueryWhitelist,
  listQueryWhitelist,
  removeFromQueryWhitelist,
} from "@/lib/query-whitelist";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/query-whitelist — 列出白名单（仅管理员）
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const items = await listQueryWhitelist();
  return NextResponse.json({ items });
}

// POST /api/admin/query-whitelist — 添加白名单地址（仅管理员）
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { address?: unknown; note?: unknown };
    const address = String(body.address ?? "").trim().toLowerCase();
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 100) : "";
    if (!/^0x[a-f0-9]{40}$/i.test(address)) {
      return NextResponse.json({ error: "地址格式不正确" }, { status: 400 });
    }
    await addToQueryWhitelist(address, note);
    const items = await listQueryWhitelist();
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("POST /api/admin/query-whitelist error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/query-whitelist?address=0x... — 移除白名单地址（仅管理员）
export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const address = (searchParams.get("address") ?? "").trim().toLowerCase();
    if (!address) {
      return NextResponse.json({ error: "缺少 address" }, { status: 400 });
    }
    await removeFromQueryWhitelist(address);
    const items = await listQueryWhitelist();
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("DELETE /api/admin/query-whitelist error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
