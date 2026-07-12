import { computeFundStats } from "@/lib/fund-stats";
import { NextRequest, NextResponse } from "next/server";

/**
 * Public shareholder self-query endpoint.
 * Returns ONLY the querent's own personal + team (15-layer downline) fund
 * aggregates. No member addresses, no order details, no other users, no
 * platform-wide data are exposed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    const stats = await computeFundStats(wallet);

    if (!stats.found) {
      return NextResponse.json({ found: false, address: stats.address });
    }

    return NextResponse.json({
      found: true,
      address: stats.address,
      uid: stats.uid,
      personal: {
        deposit: stats.personalDepositUsd,
        withdraw: stats.personalWithdrawUsd,
        net: stats.personalNetUsd,
      },
      team: {
        deposit: stats.teamDepositUsd,
        withdraw: stats.teamWithdrawUsd,
        net: stats.teamNetUsd,
        memberCount: stats.teamMemberCount,
      },
    });
  } catch (error) {
    console.error("GET /api/shareholder/[wallet] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
