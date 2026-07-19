import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAutoScanConfig } from "@/lib/auto-scan-scheduler";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/auto-scan-config — 读取定时扫描配置
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getAutoScanConfig());
}

// POST /api/admin/auto-scan-config — 更新定时扫描配置
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await getAutoScanConfig(); // 确保存在

    const data: Record<string, unknown> = {};
    if (typeof body.teamRewardEnabled === "boolean") {
      data.teamRewardEnabled = body.teamRewardEnabled;
    }
    if (typeof body.teamRewardIntervalMin === "number") {
      data.teamRewardIntervalMin = Math.min(1440, Math.max(1, Math.round(body.teamRewardIntervalMin)));
    }
    if (typeof body.teamRewardBlocksBack === "number") {
      data.teamRewardBlocksBack = Math.min(500000, Math.max(100, Math.round(body.teamRewardBlocksBack)));
    }
    if (typeof body.missingOrderEnabled === "boolean") {
      data.missingOrderEnabled = body.missingOrderEnabled;
    }
    if (typeof body.missingOrderIntervalMin === "number") {
      data.missingOrderIntervalMin = Math.min(1440, Math.max(1, Math.round(body.missingOrderIntervalMin)));
    }
    if (typeof body.missingOrderBlocksBack === "number") {
      data.missingOrderBlocksBack = Math.min(500000, Math.max(100, Math.round(body.missingOrderBlocksBack)));
    }

    const cfg = await prisma.autoScanConfig.update({ where: { id: 1 }, data });
    return NextResponse.json(cfg);
  } catch (error) {
    console.error("POST /api/admin/auto-scan-config error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
