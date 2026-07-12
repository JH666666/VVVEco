import { getVvvUsdPrice } from "@/lib/fund-stats";
import { NextResponse } from "next/server";

/**
 * Public VVV/USD price endpoint.
 * Real-time on-chain price (getLatestPrice) with DB latest-trade fallback.
 * Used by the admin sim fallback so team-reward USD conversion never relies
 * on a hardcoded constant.
 */
export async function GET() {
  try {
    const price = await getVvvUsdPrice();
    return NextResponse.json({ price });
  } catch {
    return NextResponse.json({ price: 0 });
  }
}
