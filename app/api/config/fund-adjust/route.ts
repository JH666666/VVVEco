import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getWithdrawMarkupPct, setWithdrawMarkupPct } from "@/lib/fund-adjust";
import { NextRequest, NextResponse } from "next/server";

// GET /api/config/fund-adjust — 读取出金核对加成系数（仅管理员，避免泄露核对口径）
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pct = await getWithdrawMarkupPct();
  return NextResponse.json({ withdrawMarkupPct: pct });
}

// PUT /api/config/fund-adjust — 设置出金核对加成系数（仅管理员）
export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { withdrawMarkupPct?: unknown };
    const pct = Number(body.withdrawMarkupPct);
    if (!Number.isFinite(pct)) {
      return NextResponse.json({ error: "无效的系数" }, { status: 400 });
    }
    const saved = await setWithdrawMarkupPct(pct);
    return NextResponse.json({ withdrawMarkupPct: saved });
  } catch (error) {
    console.error("PUT /api/config/fund-adjust error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
