/**
 * Next.js instrumentation hook — runs once on server startup.
 * Starts the in-process auto-scan scheduler (Node.js runtime only).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { startAutoScan } = await import("./lib/auto-scan-scheduler");
    startAutoScan();
  } catch (e) {
    console.error("[instrumentation] failed to start auto-scan scheduler:", e);
  }
}
