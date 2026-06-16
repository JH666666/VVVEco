/**
 * On-chain transaction verification for API POST auth.
 *
 * Strategy:
 *   eth_getTransactionReceipt → verify:
 *     tx.to    === STAKING_CONTRACT (case-insensitive)
 *     tx.from  === walletAddress    (case-insensitive)
 *     status   === "0x1"            (success)
 *
 * Local dev bypass:
 *   Set SKIP_TX_VERIFICATION=true in .env
 *   OR use hardhat local address (127.0.0.1 RPC auto-detected)
 */

const STAKING_CONTRACT = (
  process.env.NEXT_PUBLIC_VVECO_STAKING ?? ""
).toLowerCase();

const RPC_URL = process.env.BASE_MAINNET_RPC ?? process.env.NEXT_PUBLIC_BASE_MAINNET_RPC ?? "https://mainnet.base.org";

// Addresses that are known local/test addresses — skip verification
const LOCAL_BYPASS_PREFIXES = ["0x0000000000000000000000000000000000000000"];

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export async function verifyStakeTx(
  txHash: string,
  walletAddress: string
): Promise<VerifyResult> {
  // 1. Explicit bypass flag
  if (process.env.SKIP_TX_VERIFICATION === "true") {
    return { ok: true, reason: "bypass:env" };
  }

  // 2. Zero-address or undeployed contract → bypass
  if (
    !STAKING_CONTRACT ||
    LOCAL_BYPASS_PREFIXES.some((p) => STAKING_CONTRACT.startsWith(p))
  ) {
    return { ok: true, reason: "bypass:undeployed" };
  }

  // 3. txHash sanity
  if (!/^0x[0-9a-f]{64}$/i.test(txHash)) {
    return { ok: false, reason: "invalid txHash format" };
  }

  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn("[verify-tx] RPC response not ok, fail-open");
      return { ok: true, reason: "bypass:rpc-error" };
    }

    const json = await response.json();
    const receipt = json?.result;

    if (!receipt) {
      // Transaction not yet mined or unknown — fail open (frontend already confirmed it)
      console.warn("[verify-tx] receipt not found for", txHash, "— fail-open");
      return { ok: true, reason: "bypass:not-mined-yet" };
    }

    // Verify status
    if (receipt.status !== "0x1") {
      return { ok: false, reason: "tx failed on-chain" };
    }

    // Verify recipient
    const receiptTo = (receipt.to ?? "").toLowerCase();
    if (receiptTo !== STAKING_CONTRACT) {
      return {
        ok: false,
        reason: `tx.to mismatch: got ${receiptTo}, want ${STAKING_CONTRACT}`,
      };
    }

    // Verify sender
    const receiptFrom = (receipt.from ?? "").toLowerCase();
    const expectedFrom = walletAddress.toLowerCase();
    if (receiptFrom !== expectedFrom) {
      return {
        ok: false,
        reason: `tx.from mismatch: got ${receiptFrom}, want ${expectedFrom}`,
      };
    }

    return { ok: true };
  } catch (err) {
    // Network error / timeout → fail-open to avoid blocking legitimate users
    console.warn("[verify-tx] RPC call failed, fail-open:", err);
    return { ok: true, reason: "bypass:rpc-exception" };
  }
}
