import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  scanMissingOrders,
  scanAndRepairAll,
  repairOrderByTxHash,
  repairMissingOrder,
} from "@/lib/missing-orders";
import { NextRequest, NextResponse } from "next/server";

function isCronAuthed(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const auth = request.headers.get("Authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

// GET /api/admin/missing-orders?blocksBack=1000
// Returns missing orders found on-chain but absent from DB. Admin auth required.
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const blocksBack = Math.min(
      10000,
      Math.max(100, parseInt(searchParams.get("blocksBack") ?? "1000", 10))
    );
    const orders = await scanMissingOrders(blocksBack);
    return NextResponse.json({ missing: orders, count: orders.length });
  } catch (error) {
    console.error("GET /api/admin/missing-orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/missing-orders
// Body: {} → scan+repair all (cron or admin auth)
// Body: { txHash } → repair single order by txHash (admin auth only)
export async function POST(request: NextRequest) {
  const authed = (await isAdminAuthenticated()) || isCronAuthed(request);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    if (typeof body.txHash === "string" && body.txHash) {
      // Repair a specific order by txHash
      const order = await repairOrderByTxHash(body.txHash);
      await repairMissingOrder(order);
      return NextResponse.json({ repaired: 1, skipped: 0, order });
    }

    // Scan and repair all missing orders
    const blocksBack =
      typeof body.blocksBack === "number"
        ? Math.min(10000, Math.max(100, body.blocksBack))
        : 1000;
    const result = await scanAndRepairAll(blocksBack);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/admin/missing-orders error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
