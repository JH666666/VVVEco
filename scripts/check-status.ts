import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config({ path: "/Users/jianghu/VVVEco-cursor/VVV_Eco_Project/.env.local" });

const RPC      = "https://sepolia.base.org";
const OWNER    = "0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3";
const VVV      = process.env.NEXT_PUBLIC_VVV_TOKEN!;
const STAKING  = process.env.NEXT_PUBLIC_VVECO_STAKING!;
const PAYOUT   = process.env.NEXT_PUBLIC_VVECO_PAYOUT!;
const TREASURY = process.env.NEXT_PUBLIC_VVECO_TREASURY!;
const ROUTER   = process.env.NEXT_PUBLIC_MOCK_ROUTER!;

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];
const ROUTER_ABI = [
  "function ethBalance() view returns (uint256)",
  "function rate() view returns (uint256)",
];
const STAKING_ABI = [
  "function minStakeUsd() view returns (uint256)",
  "function durationRates(uint256) view returns (uint256)",
  "function mockPrice() view returns (uint256)",
  "function treasury() view returns (address)",
  "function payout() view returns (address)",
];

async function main() {
  const p = new ethers.JsonRpcProvider(RPC);
  const vvv     = new ethers.Contract(VVV, ERC20_ABI, p);
  const staking = new ethers.Contract(STAKING, STAKING_ABI, p);
  const router  = new ethers.Contract(ROUTER, ROUTER_ABI, p);

  console.log("=== VVV Token ===");
  const ownerVvv = await vvv.balanceOf(OWNER);
  const stakingVvv = await vvv.balanceOf(STAKING);
  const payoutVvv  = await vvv.balanceOf(PAYOUT);
  const totalSupply = await vvv.totalSupply();
  console.log(`Owner VVV:    ${ethers.formatEther(ownerVvv)} VVV`);
  console.log(`Staking VVV:  ${ethers.formatEther(stakingVvv)} VVV`);
  console.log(`Payout VVV:   ${ethers.formatEther(payoutVvv)} VVV`);
  console.log(`Total Supply: ${ethers.formatEther(totalSupply)} VVV`);

  console.log("\n=== ETH Balances ===");
  const ownerEth   = await p.getBalance(OWNER);
  const payoutEth  = await p.getBalance(PAYOUT);
  const routerEth  = await p.getBalance(ROUTER);
  const treasuryEth = await p.getBalance(TREASURY);
  console.log(`Owner ETH:    ${ethers.formatEther(ownerEth)} ETH`);
  console.log(`Payout ETH:   ${ethers.formatEther(payoutEth)} ETH`);
  console.log(`Router ETH:   ${ethers.formatEther(routerEth)} ETH`);
  console.log(`Treasury ETH: ${ethers.formatEther(treasuryEth)} ETH`);

  console.log("\n=== Router ===");
  try {
    const routerEthBal = await router.ethBalance();
    const rate = await router.rate();
    console.log(`ethBalance(): ${ethers.formatEther(routerEthBal)} ETH`);
    console.log(`rate():       ${rate} (${ethers.formatEther(rate)} ETH/VVV)`);
  } catch (e) { console.log("Router read error:", (e as Error).message); }

  console.log("\n=== Staking Config ===");
  const minUsd = await staking.minStakeUsd();
  const price  = await staking.mockPrice();
  const tAddr  = await staking.treasury();
  const pAddr  = await staking.payout();
  console.log(`minStakeUsd:  ${ethers.formatEther(minUsd)} USD`);
  console.log(`mockPrice:    $${ethers.formatEther(price)}`);
  console.log(`treasury:     ${tAddr}`);
  console.log(`payout:       ${pAddr}`);
  console.log(`treasury OK:  ${tAddr.toLowerCase() === TREASURY.toLowerCase()}`);
  console.log(`payout OK:    ${pAddr.toLowerCase() === PAYOUT.toLowerCase()}`);

  console.log("\n=== Duration Rates ===");
  for (const d of [1,2,3,4,7,15,30,60]) {
    const r = await staking.durationRates(d);
    console.log(`  [${d}d]: ${r}${r > 0 ? " ✓" : " (cleared)"}`);
  }
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
