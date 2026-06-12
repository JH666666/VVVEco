/**
 * 充值 MockRouter 流动性 + VVVPayout ETH
 * Run: npx tsx scripts/seed-basesepolia.ts
 */
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: false });

const RPC       = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
const PRIVKEY   = process.env.PRIVATE_KEY!;
const VVV_TOKEN = "0x3C03096D6174b7d6Cc6d5f1e442f43B269Bc3A30";
const ROUTER    = "0x9BB5BA22C26B816157Cd943b13bEe8967aAe01B1";
const PAYOUT    = "0x6cb514724C355Be8A2d19D1228DF8300cBb1CbA6";

const ERC20_ABI  = ["function approve(address,uint256) returns (bool)",
                    "function balanceOf(address) view returns (uint256)",
                    "function allowance(address owner, address spender) view returns (uint256)"];
const ROUTER_ABI = ["function seedVVV(uint256) external",
                    "function seedETH() external payable"];
const PAYOUT_ABI = ["function depositETH() external payable",
                    "function ethBalance() view returns (uint256)"];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet   = new ethers.Wallet(`0x${PRIVKEY.replace(/^0x/, "")}`, provider);

  const vvv    = new ethers.Contract(VVV_TOKEN, ERC20_ABI, wallet);
  const router = new ethers.Contract(ROUTER, ROUTER_ABI, wallet);
  const payout = new ethers.Contract(PAYOUT, PAYOUT_ABI, wallet);

  // ── Current balances ───────────────────────────────────────────────────────
  const deployerEth = await provider.getBalance(wallet.address);
  const deployerVvv = await vvv.balanceOf(wallet.address);
  const routerVvv   = await vvv.balanceOf(ROUTER);
  const routerEth   = await provider.getBalance(ROUTER);
  const payoutEth   = await payout.ethBalance();
  const allowance   = await vvv.allowance(wallet.address, ROUTER);

  console.log("\n═══════════════════ Current State ═══════════════════");
  console.log(`  Deployer ETH   : ${ethers.formatEther(deployerEth)}`);
  console.log(`  Deployer VVV   : ${ethers.formatEther(deployerVvv)}`);
  console.log(`  Router VVV     : ${ethers.formatEther(routerVvv)}`);
  console.log(`  Router ETH     : ${ethers.formatEther(routerEth)}`);
  console.log(`  Payout ETH     : ${ethers.formatEther(payoutEth)}`);
  console.log(`  VVV Allowance  : ${ethers.formatEther(allowance)}`);
  console.log("════════════════════════════════════════════════════\n");

  // ── Seed Router VVV if below 500k ─────────────────────────────────────────
  const TARGET_VVV = ethers.parseEther("500000");
  if (routerVvv < TARGET_VVV) {
    const needed = TARGET_VVV - routerVvv;
    console.log(`[1] Router needs ${ethers.formatEther(needed)} more VVV`);
    if (allowance < needed) {
      console.log("    approve …");
      await (await vvv.approve(ROUTER, needed)).wait();
      console.log("    ✓ approved");
    }
    await (await router.seedVVV(needed)).wait();
    console.log("    ✓ seedVVV done:", ethers.formatEther(await vvv.balanceOf(ROUTER)), "VVV");
  } else {
    console.log(`[1] Router VVV OK: ${ethers.formatEther(routerVvv)} VVV`);
  }

  // ── Seed Router ETH if below 0.005 ────────────────────────────────────────
  const TARGET_ETH = ethers.parseEther("0.005");
  if (routerEth < TARGET_ETH) {
    const needed = TARGET_ETH - routerEth;
    console.log(`[2] Router needs ${ethers.formatEther(needed)} more ETH`);
    await (await router.seedETH({ value: needed })).wait();
    console.log("    ✓ seedETH done:", ethers.formatEther(await provider.getBalance(ROUTER)), "ETH");
  } else {
    console.log(`[2] Router ETH OK: ${ethers.formatEther(routerEth)} ETH`);
  }

  // ── Seed Payout ETH if below 0.005 ────────────────────────────────────────
  const TARGET_PAYOUT = ethers.parseEther("0.005");
  if (payoutEth < TARGET_PAYOUT) {
    const needed = TARGET_PAYOUT - payoutEth;
    console.log(`[3] Payout needs ${ethers.formatEther(needed)} more ETH`);
    await (await payout.depositETH({ value: needed })).wait();
    console.log("    ✓ depositETH done:", ethers.formatEther(await payout.ethBalance()), "ETH");
  } else {
    console.log(`[3] Payout ETH OK: ${ethers.formatEther(payoutEth)} ETH`);
  }

  // ── Final state ────────────────────────────────────────────────────────────
  console.log("\n═══════════════════ Final State ════════════════════");
  console.log(`  Router VVV  : ${ethers.formatEther(await vvv.balanceOf(ROUTER))} VVV`);
  console.log(`  Router ETH  : ${ethers.formatEther(await provider.getBalance(ROUTER))} ETH`);
  console.log(`  Payout ETH  : ${ethers.formatEther(await payout.ethBalance())} ETH`);
  console.log("════════════════════════════════════════════════════\n");
  console.log("✅  Seeding complete.");
}

main().catch(e => { console.error(e.message ?? e); process.exit(1); });
