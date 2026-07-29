import { NextRequest, NextResponse } from "next/server";

const RPC = process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org";

/**
 * 服务端读取交易回执（可靠 RPC），供前端轮询。
 * 手机钱包(TP)自带 provider 读 eth_getTransactionReceipt 常不可靠/卡住，
 * 改由服务器读，交易一上链即可拿到回执。
 * GET /api/tx-receipt?hash=0x...
 */
export async function GET(req: NextRequest) {
  const hash = (req.nextUrl.searchParams.get("hash") ?? "").trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    return NextResponse.json({ receipt: null });
  }
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [hash] }),
    });
    const j = await res.json();
    return NextResponse.json({ receipt: j.result ?? null });
  } catch (e) {
    console.error("GET /api/tx-receipt error:", e);
    return NextResponse.json({ receipt: null });
  }
}
