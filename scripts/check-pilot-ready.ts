import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const RPC      = "https://sepolia.base.org";
const OWNER    = "0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3";
const VVV      = process.env.NEXT_PUBLIC_VVV_TOKEN!;
const STAKING  = process.env.NEXT_PUBLIC_VVECO_STAKING!;
const PAYOUT   = process.env.NEXT_PUBLIC_VVECO_PAYOUT!;
const TREASURY = process.env.NEXT_PUBLIC_VVECO_TREASURY!;
const ROUTER   = process.env.NEXT_PUBLIC_MOCK_ROUTER!;

const ERC20    = ["function balanceOf(address) view returns (uint256)"];
const STAKING_ABI = [
  "function minStakeUsd() view returns (uint256)",
  "function durationRates(uint256) view returns (uint256)",
];
const TREASURY_ABI = ["function stakingContract() view returns (address)"];
const PAYOUT_ABI   = ["function stakingContract() view returns (address)"];
const ROUTER_ABI   = ["function ethPerVvv() view returns (uint256)"];

async function main() {
  const p      = new ethers.JsonRpcProvider(RPC);
  const vvv     = new ethers.Contract(VVV, ERC20, p);
  const staking = new ethers.Contract(STAKING, STAKING_ABI, p);
  const treasury = new ethers.Contract(TREASURY, TREASURY_ABI, p);
  const payout   = new ethers.Contract(PAYOUT, PAYOUT_ABI, p);
  const router   = new ethers.Contract(ROUTER, ROUTER_ABI, p);

  // 1. Owner VVV
  const ownerVvv = await vvv.balanceOf(OWNER);
  // 2. Router ETH
  const routerEth = await p.getBalance(ROUTER);
  // 3. Router VVV
  const routerVvv = await vvv.balanceOf(ROUTER);
  // 4. Treasury ETH
  const treasuryEth = await p.getBalance(TREASURY);
  // 5. Payout ETH
  const payoutEth = await p.getBalance(PAYOUT);
  // 6. Staking address (from env)
  // 7. Treasury.stakingContract
  const treasuryStaking = await treasury.stakingContract();
  // 8. Payout.stakingContract
  const payoutStaking = await payout.stakingContract();
  // 9. minStakeUsd
  const minUsd = await staking.minStakeUsd();
  // 10. durationRates
  const rates: Record<number, bigint> = {};
  for (const d of [1,2,3,4]) rates[d] = await staking.durationRates(d);
  // Router rate
  const ethPerVvv = await router.ethPerVvv();

  // ── 判断 ──────────────────────────────────────────────────────────────────

  // 对于一笔 $10 质押（~67 VVV），Router 需要有足够 ETH 完成 VVV→ETH swap
  // ethPerVvv 是 wei/VVV，每笔 $10 耗 ETH = 67 * ethPerVvv / 1e18
  const vvvPerTen = BigInt(67) * BigInt(1e18);  // 67 VVV in wei
  const ethPerStake = vvvPerTen * ethPerVvv / BigInt(1e18);

  // Payout 要能支付 1天到期的收益（67 VVV * 1% = 0.67 VVV → ETH）
  const rewardVvv = vvvPerTen / 100n;
  const ethPerReward = rewardVvv * ethPerVvv / BigInt(1e18);

  const issues: string[] = [];

  console.log("=== Mainnet Pilot 就绪检查 ===\n");

  // 1
  const ownerVvvF = Number(ethers.formatEther(ownerVvv));
  const ok1 = ownerVvvF >= 1000;
  console.log(`1. Owner VVV 余额:          ${ownerVvvF.toLocaleString()} VVV  ${ok1 ? "✓" : "✗"}`);
  if (!ok1) issues.push("Owner VVV 不足（< 1000 VVV），无法测试质押");

  // 2
  const routerEthF = Number(ethers.formatEther(routerEth));
  const ok2 = routerEth >= ethPerStake * 5n;   // 至少够 5 笔 $10 质押
  console.log(`2. Router ETH 余额:         ${routerEthF.toFixed(6)} ETH  ${ok2 ? "✓" : "✗"}`);
  if (!ok2) issues.push(`Router ETH 不足（当前 ${routerEthF.toFixed(6)} ETH），建议 owner 调用 seedETH 补充至少 0.001 ETH`);

  // 3
  const routerVvvF = Number(ethers.formatEther(routerVvv));
  const ok3 = routerVvvF >= 100;   // 至少 100 VVV 用于兑付收益
  console.log(`3. Router VVV 余额:         ${routerVvvF.toLocaleString()} VVV  ${ok3 ? "✓" : "✗"}`);
  if (!ok3) issues.push(`Router VVV 不足（当前 ${routerVvvF} VVV），需 owner 调用 seedVVV 补充`);

  // 4
  const treasuryEthF = Number(ethers.formatEther(treasuryEth));
  console.log(`4. Treasury ETH 余额:       ${treasuryEthF.toFixed(6)} ETH  ✓（Treasury 不需预存 ETH）`);

  // 5
  const payoutEthF = Number(ethers.formatEther(payoutEth));
  const ok5 = payoutEth >= ethPerReward * 5n;
  console.log(`5. Payout ETH 余额:         ${payoutEthF.toFixed(6)} ETH  ${ok5 ? "✓" : "✗"}`);
  if (!ok5) issues.push(`Payout ETH 不足（当前 ${payoutEthF.toFixed(6)} ETH），建议补充至少 0.001 ETH`);

  // 6
  console.log(`6. Staking 合约地址:        ${STAKING}  ✓`);

  // 7
  const ok7 = treasuryStaking.toLowerCase() === STAKING.toLowerCase();
  console.log(`7. Treasury.stakingContract: ${treasuryStaking}  ${ok7 ? "✓" : "✗"}`);
  if (!ok7) issues.push(`Treasury.stakingContract 指向错误地址（${treasuryStaking}），需调用 setStakingContract(${STAKING})`);

  // 8
  const ok8 = payoutStaking.toLowerCase() === STAKING.toLowerCase();
  console.log(`8. Payout.stakingContract:   ${payoutStaking}  ${ok8 ? "✓" : "✗"}`);
  if (!ok8) issues.push(`Payout.stakingContract 指向错误地址（${payoutStaking}），需调用 setStakingContract(${STAKING})`);

  // 9
  const minUsdF = Number(ethers.formatEther(minUsd));
  const ok9 = minUsdF === 10;
  console.log(`9. minStakeUsd:              ${minUsdF} USD  ${ok9 ? "✓" : "✗"}`);
  if (!ok9) issues.push(`minStakeUsd 不是 10（当前 ${minUsdF}），需调用 setMinStakeUsd(10 ether)`);

  // 10
  const rateOk = [1,2,3,4].every(d => rates[d] === 10n);
  console.log(`10. durationRates:`);
  for (const d of [1,2,3,4]) {
    const r = rates[d];
    const ok = r === 10n;
    console.log(`    ${d}天 = ${r}/1000 = ${Number(r)/10}%/day  ${ok ? "✓" : "✗"}`);
    if (!ok) issues.push(`durationRates[${d}] 不是 10（当前 ${r}）`);
  }

  // ── 结论 ─────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  if (issues.length === 0) {
    console.log("\n✓ 可以开始测试\n");
  } else {
    console.log("\n✗ 不可以开始测试\n");
    console.log("缺少 / 需修复：");
    issues.forEach((s, i) => console.log(`  ${i+1}. ${s}`));
    console.log();
  }
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
