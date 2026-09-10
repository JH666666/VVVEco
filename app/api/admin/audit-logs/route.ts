import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/audit-logs?target=&action=&page=1&pageSize=20
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get("target") ?? "";
    const action = searchParams.get("action") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

    const where: Record<string, unknown> = {};
    if (target) where.targetAddress = target.toLowerCase();
    if (action) where.actionType = action;

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return NextResponse.json({
      items: logs.map((l) => ({
        id: String(l.id),
        adminAddress: l.adminAddress,
        targetAddress: l.targetAddress,
        actionType: l.actionType,
        actionValue: l.actionValue,
        createdAt: l.createdAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch {
    return NextResponse.json({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  }
}
