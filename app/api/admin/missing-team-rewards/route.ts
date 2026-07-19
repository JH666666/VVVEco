import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  scanMissingTeamRewards,
  scanAndRepairAllTeamRewards,
  repairTeamRewardByTxHash,
} from "@/lib/missing-team-rewards";
import { NextRequest, NextResponse } from "next/server";

function isCronAuthed(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const auth = request.headers.get("Authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

// GET /api/admin/missing-team-rewards?blocksBack=1000
// 返回链上有、DB 缺失的团队奖励。需管理员登录。
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const blocksBack = Math.min(
      50000,
      Math.max(100, parseInt(searchParams.get("blocksBack") ?? "1000", 10))
    );
    const missing = await scanMissingTeamRewards(blocksBack);
    return NextResponse.json({ missing, count: missing.length });
  } catch (error) {
    console.error("GET /api/admin/missing-team-rewards error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/missing-team-rewards
// Body: {} → 扫描+补录全部（cron 或管理员）
// Body: { txHash } → 按 txHash 补录（管理员）
export async function POST(request: NextRequest) {
  const authed = (await isAdminAuthenticated()) || isCronAuthed(request);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (typeof body.txHash === "string" && body.txHash) {
      const result = await repairTeamRewardByTxHash(body.txHash);
      return NextResponse.json(result);
    }

    const blocksBack =
      typeof body.blocksBack === "number"
        ? Math.min(50000, Math.max(100, body.blocksBack))
        : 1000;
    const result = await scanAndRepairAllTeamRewards(blocksBack);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/admin/missing-team-rewards error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
