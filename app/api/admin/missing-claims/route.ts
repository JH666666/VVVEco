import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  scanMissingClaims,
  repairMissingClaim,
  repairClaimByTxHash,
} from "@/lib/missing-claims";
import { NextRequest, NextResponse } from "next/server";

function isCronAuthed(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  return (request.headers.get("Authorization") ?? "") === `Bearer ${secret}`;
}

// GET /api/admin/missing-claims?blocksBack=2000 — 预览缺失的领取记录
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const blocksBack = Math.min(200000, Math.max(100, parseInt(searchParams.get("blocksBack") ?? "2000", 10)));
    const missing = await scanMissingClaims(blocksBack);
    return NextResponse.json({ missing, count: missing.length });
  } catch (error) {
    console.error("GET /api/admin/missing-claims error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/missing-claims
//  Body {} 或 { blocksBack } → 扫描最近 N 区块并补录
//  Body { claimTxHash }       → 按单笔领取交易补录
export async function POST(request: NextRequest) {
  const authed = (await isAdminAuthenticated()) || isCronAuthed(request);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (typeof body.claimTxHash === "string" && body.claimTxHash) {
      const result = await repairClaimByTxHash(body.claimTxHash);
      return NextResponse.json(result);
    }

    const blocksBack = typeof body.blocksBack === "number"
      ? Math.min(200000, Math.max(100, body.blocksBack))
      : 2000;
    const missing = await scanMissingClaims(blocksBack);
    let repaired = 0;
    let skipped = 0;
    for (const c of missing) {
      (await repairMissingClaim(c)) ? repaired++ : skipped++;
    }
    return NextResponse.json({ repaired, skipped, found: missing.length });
  } catch (error) {
    console.error("POST /api/admin/missing-claims error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
