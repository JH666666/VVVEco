import { computeFundDetail } from "@/lib/fund-stats";
import { isAddressWhitelisted } from "@/lib/query-whitelist";
import { NextRequest, NextResponse } from "next/server";

/**
 * Public shareholder self-query endpoint.
 * Returns ONLY the querent's own personal + team (15-layer downline) fund
 * detail. No other users, no platform-wide data.
 * 仅白名单地址可查询：管理员未在后台加入白名单的地址一律拒绝。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;

    // 白名单门禁：只有后台添加到白名单的地址才能查询
    if (!(await isAddressWhitelisted(wallet))) {
      return NextResponse.json(
        { found: false, notWhitelisted: true, address: wallet.trim().toLowerCase() },
        { status: 403 }
      );
    }

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
