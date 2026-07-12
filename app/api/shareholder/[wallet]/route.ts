import { computeFundDetail } from "@/lib/fund-stats";
import { NextRequest, NextResponse } from "next/server";

/**
 * Public shareholder self-query endpoint.
 * Returns ONLY the querent's own personal + team (15-layer downline) fund
 * detail. No other users, no platform-wide data.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    const detail = await computeFundDetail(wallet);

    if (!detail.found) {
      return NextResponse.json({ found: false, address: detail.address });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("GET /api/shareholder/[wallet] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
