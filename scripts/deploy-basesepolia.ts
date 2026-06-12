/**
 * VVVEco — Base Sepolia Deployment Script
 *
 * 基于 scripts/deploy-local.ts（已通过 36/36 集成测试）
 *
 * 前提条件：
 *   1. .env 中填写真实 PRIVATE_KEY（不含 0x 前缀，账户需有 ≥0.05 ETH Base Sepolia 测试币）
 *   2. BASE_SEPOLIA_RPC 已设置（或使用默认公共节点）
 *   3. npx hardhat compile 已运行，artifacts 目录存在
 *
 * 运行方式：
 *   npx tsx scripts/deploy-basesepolia.ts
 *
 * 部署顺序：
 *   VVVToken → MockRouter → VVVTreasury → VVVPayout → VVVEcoStaking
 *
 * 输出：
 *   deployments/base-sepolia.json
 *   控制台打印 NEXT_PUBLIC 变量（需手动写入 .env.local，脚本不自动覆盖）
 */

import { ethers, NonceManager } from "ethers";
import * as fs   from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

// ── dotenv: 先读 .env，再以不覆盖模式读 .env.local ─────────────────────────
// Next.js 优先级：.env.local > .env
// 脚本保持相同优先级：.env.local 中的值优先（若存在）
dotenv.config();                                  // 读 .env
dotenv.config({ path: ".env.local", override: true }); // .env.local 覆盖（与 Next.js 一致）

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Config ────────────────────────────────────────────────────────────────────
const RPC         = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
const ROUTER_RATE = BigInt("10000000000"); // 1e10 = 1 VVV → 0.00000001 ETH（支持百万级 VVV 质押）
const FEE_PERCENT = 10;                         // VVVPayout 手续费 10%
const WETH        = ethers.ZeroAddress;         // MockRouter 忽略 path

// ── 私钥校验 ──────────────────────────────────────────────────────────────────
const rawKey = process.env.PRIVATE_KEY ?? "";
if (!rawKey || rawKey === "your_private_key_here" || rawKey.length < 32) {
  console.error("❌  PRIVATE_KEY 未设置或仍为占位符。");
  console.error("    请在 .env 中填写真实私钥，再运行此脚本。");
  process.exit(1);
}
const DEPLOYER_KEY = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function art(name: string) {
  const p = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  if (!fs.existsSync(p)) {
    console.error(`❌  Artifact not found: ${p}`);
    console.error("    先运行: npx hardhat compile");
    process.exit(1);
  }
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi, bytecode: j.bytecode };
}

async function deployC(
  signer: ethers.Signer,
  name: string,
  ...args: unknown[]
): Promise<ethers.Contract> {
  const { abi, bytecode } = art(name);
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const c = await factory.deploy(...(args as never[]));
  await c.waitForDeployment();
  return c as ethers.Contract;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  VVVEco — Base Sepolia Deployment");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  RPC       : ${RPC}`);

  const provider  = new ethers.JsonRpcProvider(RPC);
  const _deployer = new ethers.Wallet(DEPLOYER_KEY, provider);
  // NonceManager 防止 ethers v6 nonce 缓存 bug（并发交易场景）
  const deployer  = new NonceManager(_deployer);
  const deployerAddr = _deployer.address;

  console.log(`  Deployer  : ${deployerAddr}`);

  const ethBal = await provider.getBalance(deployerAddr);
  console.log(`  ETH bal   : ${ethers.formatEther(ethBal)} ETH`);

  if (ethBal < ethers.parseEther("0.01")) {
    console.error("\n❌  余额不足 0.01 ETH，无法支付 gas。");
    console.error("    前往 https://faucet.quicknode.com/base/sepolia 领取测试 ETH。");
    process.exit(1);
  }

  // 验证网络
  const network = await provider.getNetwork();
  if (network.chainId !== 84532n) {
    console.error(`\n❌  RPC 返回 chainId=${network.chainId}，期望 84532 (Base Sepolia)。`);
    console.error("    请检查 BASE_SEPOLIA_RPC 配置。");
    process.exit(1);
  }
  console.log(`  Chain ID  : ${network.chainId} ✓ Base Sepolia`);
  console.log("");

  // ── 1. VVVToken ─────────────────────────────────────────────────────────────
  process.stdout.write("  [1/5] VVVToken      ... ");
  const vvvToken  = await deployC(deployer, "VVVToken");
  const vvvAddr   = await vvvToken.getAddress();
  console.log(vvvAddr);

  // ── 2. MockRouter ───────────────────────────────────────────────────────────
  process.stdout.write("  [2/5] MockRouter    ... ");
  const mockRouter = await deployC(deployer, "MockRouter", vvvAddr);
  const routerAddr = await mockRouter.getAddress();
  console.log(routerAddr);

  // ── 3. VVVTreasury ──────────────────────────────────────────────────────────
  process.stdout.write("  [3/5] VVVTreasury   ... ");
  const treasury    = await deployC(deployer, "VVVTreasury", vvvAddr, routerAddr, WETH, deployerAddr);
  const treasuryAddr = await treasury.getAddress();
  console.log(treasuryAddr);

  // ── 4. VVVPayout ────────────────────────────────────────────────────────────
  process.stdout.write("  [4/5] VVVPayout     ... ");
  const payout    = await deployC(deployer, "VVVPayout", vvvAddr, routerAddr, WETH, deployerAddr, FEE_PERCENT);
  const payoutAddr = await payout.getAddress();
  console.log(payoutAddr);

  // ── 5. VVVEcoStaking ────────────────────────────────────────────────────────
  // constructor(address _vvvToken, address _treasury, address _payout)
  process.stdout.write("  [5/5] VVVEcoStaking ... ");
  const staking    = await deployC(deployer, "VVVEcoStaking", vvvAddr, treasuryAddr, payoutAddr);
  const stakingAddr = await staking.getAddress();
  console.log(stakingAddr);

  // ── Post-deployment configuration ─────────────────────────────────────────
  console.log("\n─── 部署后配置 ──────────────────────────────────────────────");

  // MockRouter: 设置汇率
  await (await mockRouter.setRate(ROUTER_RATE)).wait();
  console.log("  ✓ MockRouter.setRate(1e14)        1 VVV = 0.0001 ETH");

  // ⚠️  注意：测试网 MockRouter 的 ETH/VVV 初始流动性需手动充值。
  //    部署后通过 Basescan 或 admin 面板调用：
  //      MockRouter.seedETH{ value: 0.1 ETH }()
  //      VVVToken.approve(routerAddr, 1000000 VVV)
  //      MockRouter.seedVVV(1000000 VVV)
  console.log("  ⚠️  MockRouter 流动性需手动充值（见部署后检查清单）");

  // VVVTreasury: 绑定 staking 合约
  await (await treasury.setStakingContract(stakingAddr)).wait();
  console.log("  ✓ VVVTreasury.setStakingContract  done");

  // VVVPayout: 绑定 staking 合约
  await (await payout.setStakingContract(stakingAddr)).wait();
  console.log("  ✓ VVVPayout.setStakingContract    done");

  // ⚠️  VVVPayout ETH 余额：测试网需手动 depositETH
  //    通过 Basescan 调用：VVVPayout.depositETH{ value: 0.05 ETH }()
  console.log("  ⚠️  VVVPayout ETH 余额需手动充值（见部署后检查清单）");

  // ── 验证关键状态 ────────────────────────────────────────────────────────────
  console.log("\n─── 合约状态验证 ─────────────────────────────────────────────");
  const stakingOwner  = await staking.owner();
  const rootRef       = await staking.rootReferrer();
  const rate30        = await staking.durationRates(30);
  const treasuryCheck = await treasury.stakingContract().catch(() => "(getter not available)");

  console.log(`  staking.owner()         = ${stakingOwner}`);
  console.log(`  staking.rootReferrer()  = ${rootRef}`);
  console.log(`  staking.durationRates(30) = ${rate30}  (应为 9)`);
  console.log(`  treasury.staking        = ${treasuryCheck}`);

  const ownerOk   = stakingOwner.toLowerCase() === deployerAddr.toLowerCase();
  const rootOk    = rootRef.toLowerCase() === deployerAddr.toLowerCase();
  const rate30Ok  = rate30.toString() === "9";

  console.log(`\n  ${ownerOk ? "✅" : "❌"}  owner 匹配部署地址`);
  console.log(`  ${rootOk  ? "✅" : "❌"}  rootReferrer 匹配部署地址`);
  console.log(`  ${rate30Ok ? "✅" : "❌"}  durationRates(30) == 9`);

  // ── 保存 deployments/base-sepolia.json ─────────────────────────────────────
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const deployment = {
    network:     "base-sepolia",
    chainId:     84532,
    deployedAt:  new Date().toISOString(),
    deployer:    deployerAddr,
    contracts: {
      VVVToken:      vvvAddr,
      MockRouter:    routerAddr,
      VVVTreasury:   treasuryAddr,
      VVVPayout:     payoutAddr,
      VVVEcoStaking: stakingAddr,
    },
    config: {
      routerRate:   ROUTER_RATE.toString(),
      feePercent:   FEE_PERCENT,
      projectWallet: deployerAddr,
      feeWallet:     deployerAddr,
      note: "MockRouter 流动性 & VVVPayout ETH 需部署后手动充值",
    },
  };

  const outPath = path.join(deploymentsDir, "base-sepolia.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\n  📄  Saved → deployments/base-sepolia.json`);

  // ── 最终输出：NEXT_PUBLIC 变量（需手动复制到 .env.local）──────────────────
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  ✅  部署完成");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`
⚠️  请将以下内容 手动复制 到 .env.local（脚本不自动覆盖）:

# ── Base Sepolia 合约地址 ──────────────────────────────────
NEXT_PUBLIC_VVV_TOKEN=${vvvAddr}
NEXT_PUBLIC_VVECO_STAKING=${stakingAddr}
NEXT_PUBLIC_VVECO_PAYOUT=${payoutAddr}
NEXT_PUBLIC_VVECO_TREASURY=${treasuryAddr}
NEXT_PUBLIC_MOCK_ROUTER=${routerAddr}
# ──────────────────────────────────────────────────────────

完成后重启 Next.js（npm run dev 或重新 build）。
`);

  console.log("📋  部署后操作清单（见下方）:");
  console.log("  1. 手动充值 MockRouter 流动性:");
  console.log(`       Basescan → MockRouter(${routerAddr})`);
  console.log(`       → seedETH, value: 0.1 ETH`);
  console.log(`       → VVVToken.approve(${routerAddr}, 1000000e18)`);
  console.log(`       → seedVVV(1000000e18)`);
  console.log("  2. 手动充值 VVVPayout ETH:");
  console.log(`       Basescan → VVVPayout(${payoutAddr})`);
  console.log(`       → depositETH, value: 0.05 ETH`);
  console.log("  3. 更新 rootReferrer 为项目方正式地址（若部署钱包非最终运营钱包）:");
  console.log(`       → VVVEcoStaking.setRootReferrer(<项目方地址>)`);
  console.log("  4. 将 .env.local 中 NEXT_PUBLIC_ROOT_REFERRER_ADDRESS 更新为同一地址");
}

main().catch(e => {
  console.error("\n❌  部署失败:", e.message ?? e);
  process.exit(1);
});
