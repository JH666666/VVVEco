/**
 * VVVEco — Local Hardhat Deployment Script
 *
 * 前提: npx hardhat node 已在另一终端运行
 * 运行: npx hardhat run scripts/deploy-local.ts --network localhost
 *
 * 部署顺序: VVVToken → MockRouter → VVVTreasury → VVVPayout → VVVEcoStaking
 * 输出: deployments/localhost.json + .env.local 建议（不自动覆盖）
 */

import { ethers, NonceManager } from "ethers";
import * as fs   from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Config ────────────────────────────────────────────────────────────────────
const RPC          = "http://127.0.0.1:8545";
const ROUTER_RATE  = BigInt("100000000000000"); // 1e14 = 1 VVV → 0.0001 ETH
const ROUTER_ETH   = ethers.parseEther("5");
const ROUTER_VVV   = ethers.parseEther("1000000");
const PAYOUT_ETH   = ethers.parseEther("10");
const FEE_PERCENT  = 10;
const WETH         = ethers.ZeroAddress; // MockRouter ignores path

// Hardhat default account #0
const DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// ── Helpers ───────────────────────────────────────────────────────────────────
function art(name: string) {
  const p = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi, bytecode: j.bytecode };
}

async function deployC(signer: ethers.Signer, name: string, ...args: unknown[]) {
  const { abi, bytecode } = art(name);
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const c = await factory.deploy(...(args as never[]));
  await c.waitForDeployment();
  return c;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const _deployer = new ethers.Wallet(DEPLOYER_KEY, provider);
  // Wrap in NonceManager to avoid ethers v6 nonce-caching bug
  const deployer  = new NonceManager(_deployer);

  console.log("═══════════════════════════════════════════════════════");
  console.log("  VVVEco — Local Hardhat Deployment");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Deployer  : ${_deployer.address}`);
  console.log(`  ETH bal   : ${ethers.formatEther(await provider.getBalance(_deployer.address))} ETH`);
  console.log("");

  // ── 1. VVVToken ─────────────────────────────────────────────────────────
  process.stdout.write("  [1/5] VVVToken      ... ");
  const vvvToken = await deployC(deployer, "VVVToken");
  const vvvAddr  = await vvvToken.getAddress();
  console.log(vvvAddr);

  // ── 2. MockRouter ───────────────────────────────────────────────────────
  process.stdout.write("  [2/5] MockRouter    ... ");
  const mockRouter = await deployC(deployer, "MockRouter", vvvAddr);
  const routerAddr = await mockRouter.getAddress();
  console.log(routerAddr);

  // ── 3. VVVTreasury ──────────────────────────────────────────────────────
  process.stdout.write("  [3/5] VVVTreasury   ... ");
  const treasury    = await deployC(deployer, "VVVTreasury", vvvAddr, routerAddr, WETH, _deployer.address);
  const treasuryAddr = await treasury.getAddress();
  console.log(treasuryAddr);

  // ── 4. VVVPayout ────────────────────────────────────────────────────────
  process.stdout.write("  [4/5] VVVPayout     ... ");
  const payout    = await deployC(deployer, "VVVPayout", vvvAddr, routerAddr, WETH, _deployer.address, FEE_PERCENT);
  const payoutAddr = await payout.getAddress();
  console.log(payoutAddr);

  // ── 5. VVVEcoStaking ────────────────────────────────────────────────────
  process.stdout.write("  [5/5] VVVEcoStaking ... ");
  const staking    = await deployC(deployer, "VVVEcoStaking", vvvAddr, treasuryAddr, payoutAddr);
  const stakingAddr = await staking.getAddress();
  console.log(stakingAddr);

  // ── Post-deployment configuration ─────────────────────────────────────
  console.log("\n─── Post-deployment configuration ──────────────────────");

  await (mockRouter as ethers.Contract).setRate(ROUTER_RATE);
  console.log(`  ✓ MockRouter.setRate(1e14)       1 VVV = 0.0001 ETH`);

  await (mockRouter as ethers.Contract).seedETH({ value: ROUTER_ETH });
  console.log(`  ✓ MockRouter.seedETH              ${ethers.formatEther(ROUTER_ETH)} ETH`);

  await (vvvToken as ethers.Contract).approve(routerAddr, ROUTER_VVV);
  await (mockRouter as ethers.Contract).seedVVV(ROUTER_VVV);
  console.log(`  ✓ MockRouter.seedVVV              ${ethers.formatEther(ROUTER_VVV)} VVV`);

  await (treasury as ethers.Contract).setStakingContract(stakingAddr);
  console.log(`  ✓ VVVTreasury.setStakingContract  done`);

  await (payout as ethers.Contract).setStakingContract(stakingAddr);
  console.log(`  ✓ VVVPayout.setStakingContract    done`);

  await (payout as ethers.Contract).depositETH({ value: PAYOUT_ETH });
  console.log(`  ✓ VVVPayout.depositETH            ${ethers.formatEther(PAYOUT_ETH)} ETH`);

  // ── Save deployments/localhost.json ────────────────────────────────────
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);

  const deployment = {
    network:     "localhost",
    chainId:     31337,
    deployedAt:  new Date().toISOString(),
    deployer:    _deployer.address,
    contracts: {
      VVVToken:      vvvAddr,
      MockRouter:    routerAddr,
      VVVTreasury:   treasuryAddr,
      VVVPayout:     payoutAddr,
      VVVEcoStaking: stakingAddr,
    },
    config: {
      routerRate:       ROUTER_RATE.toString(),
      routerEthSeed:    ethers.formatEther(ROUTER_ETH),
      routerVvvSeed:    ethers.formatEther(ROUTER_VVV),
      payoutEthDeposit: ethers.formatEther(PAYOUT_ETH),
      feePercent:       FEE_PERCENT,
      projectWallet:    _deployer.address,
      feeWallet:        _deployer.address,
    },
  };

  fs.writeFileSync(
    path.join(deploymentsDir, "localhost.json"),
    JSON.stringify(deployment, null, 2)
  );

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅  Deployment complete");
  console.log("  📄  Saved → deployments/localhost.json");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("📝  .env.local 建议（手动添加，不自动覆盖）:\n");
  console.log(`  NEXT_PUBLIC_VVV_TOKEN=${vvvAddr}`);
  console.log(`  NEXT_PUBLIC_VVECO_STAKING=${stakingAddr}`);
  console.log(`  NEXT_PUBLIC_VVECO_PAYOUT=${payoutAddr}`);
  console.log(`  NEXT_PUBLIC_VVECO_TREASURY=${treasuryAddr}`);
  console.log(`  NEXT_PUBLIC_MOCK_ROUTER=${routerAddr}`);
  console.log();
}

main().catch(e => { console.error(e); process.exit(1); });
