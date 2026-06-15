/**
 * VVVEco — Base Mainnet Deployment Script
 *
 * 前提条件：
 *   1. .env 中填写 PRIVATE_KEY（不含 0x 前缀，账户需有 ≥ 0.01 ETH Base Mainnet）
 *   2. BASE_MAINNET_RPC 已设置（付费 RPC，如 Alchemy / QuickNode）
 *   3. npx hardhat compile 已运行，4 份合约 artifact 均存在
 *
 * 运行方式（主网，真实广播）：
 *   npx tsx scripts/deploy-mainnet.ts
 *
 * 部署顺序：
 *   1. AerodromeAdapter   — 无依赖
 *   2. VVVTreasury        — 依赖 AerodromeAdapter 地址
 *   3. VVVPayout          — 依赖 AerodromeAdapter 地址
 *   4. VVVEcoStaking      — 依赖 Treasury + Payout + PricePool + EthUsdFeed
 *
 * 不部署：VVVToken（已有主网合约），MockRouter（不用于主网）
 *
 * 部署后自动执行：
 *   - Treasury.setStakingContract(stakingAddr)
 *   - Payout.setStakingContract(stakingAddr)
 *   - Staking.setRootReferrer(ROOT_REFERRER)
 *
 * ⚠️  Payout.depositETH 不在本脚本中执行。
 *     部署完成后，必须单独向 Payout 合约注入 ETH，否则 claim 会进队列。
 *     注资命令（部署后执行）：
 *       cast send <payoutAddr> "depositETH()" --value 0.5ether --private-key $PRIVATE_KEY --rpc-url $BASE_MAINNET_RPC
 *
 * 输出：
 *   deployments/base-mainnet.json
 *   控制台打印 NEXT_PUBLIC 变量（需手动写入 .env.local）
 */

import { ethers, NonceManager } from "ethers";
import * as fs   from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Mainnet constants (immutable, verified on-chain) ─────────────────────────

const CHAIN_ID       = 8453n;
const VVV_TOKEN      = "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf"; // VVV on Base Mainnet
const WETH           = "0x4200000000000000000000000000000000000006"; // Base canonical WETH
const AERO_ROUTER    = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43"; // Aerodrome Router
const AERO_FACTORY   = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da"; // Aerodrome vAMM factory
const STABLE         = false;                                          // VVV/WETH is volatile

const PRICE_POOL     = "0x01784ef301D79e4B2DF3a21ad9a536d4cF09A5Ce"; // Aerodrome vAMM VVV/WETH
const ETH_USD_FEED   = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"; // Chainlink ETH/USD

const PROJECT_WALLET = "0xa8c9118d6cf6164EBDC2aB99F19A9B36F599f191";
const FEE_WALLET     = "0xb32134EA32276dD8cB7Ec689958d8cb9BaD60506";
const ROOT_REFERRER  = "0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3";
const OWNER          = "0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3";

const FEE_PERCENT    = 10;
const MIN_ETH_BAL    = ethers.parseEther("0.01"); // abort if deployer has less (gas only)

// ── Helpers ───────────────────────────────────────────────────────────────────

function art(name: string) {
  const p = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  if (!fs.existsSync(p)) {
    console.error(`\n❌  Artifact not found: ${p}`);
    console.error("    先运行: npx hardhat compile");
    process.exit(1);
  }
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi as ethers.InterfaceAbi, bytecode: j.bytecode as string };
}

async function deploy(
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

function assert(ok: boolean, msg: string) {
  if (!ok) {
    console.error(`\n❌  验证失败: ${msg}`);
    process.exit(1);
  }
}

// ── Dry Run: DRY_RUN=true npx tsx scripts/deploy-mainnet.ts ──────────────────

function printParamsAndExit(): never {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  VVVEco — Base Mainnet Deployment · DRY RUN (no broadcast)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n── 部署参数（人工确认后再执行正式部署）──────────────────────\n");
  console.log(`  VVV Token        : ${VVV_TOKEN}`);
  console.log(`  WETH             : ${WETH}`);
  console.log(`  Aerodrome Router : ${AERO_ROUTER}`);
  console.log(`  Aerodrome Factory: ${AERO_FACTORY}`);
  console.log(`  Price Pool       : ${PRICE_POOL}`);
  console.log(`  ETH/USD Feed     : ${ETH_USD_FEED}`);
  console.log(`  Owner / Deployer : ${OWNER}`);
  console.log(`  Root Referrer    : ${ROOT_REFERRER}`);
  console.log(`  Project Wallet   : ${PROJECT_WALLET}`);
  console.log(`  Fee Wallet       : ${FEE_WALLET}`);
  console.log("\n── Staking 默认参数（Solidity 初始化，无需手动设置）─────────\n");
  console.log("  minStakeUsd      : 100 ether ($100)");
  console.log("  durationRates    : 7d→7‰  15d→8‰  30d→9‰  60d→10‰ (/day)");
  console.log("  inviteRates      : gen1=15%  gen2=10%  gen3=5%");
  console.log("  levelRates       : V1=10% V2=20% ... V8=80%");
  console.log("  levelThresholds  : V2=$10K V3=$20K V4=$30K V5=$50K V6=$100K V7=$150K V8=$200K");
  console.log("  paused           : false (上线即可用)");
  console.log("\n── 部署后脚本自动执行（无需手动）────────────────────────────\n");
  console.log("  Treasury.setStakingContract(<stakingAddr>)");
  console.log("  Payout.setStakingContract(<stakingAddr>)");
  console.log(`  Staking.setRootReferrer(${ROOT_REFERRER})`);
  console.log("\n── ⚠️  Payout 未注资（必须手动执行，否则 claim 进队列）────\n");
  console.log("  cast send <payoutAddr> \"depositETH()\" \\");
  console.log("    --value 0.5ether \\");
  console.log("    --private-key $PRIVATE_KEY \\");
  console.log("    --rpc-url $BASE_MAINNET_RPC");
  console.log("\n── 部署后需手动执行（admin 面板）────────────────────────────\n");
  console.log(`  1. 更新 .env.local 的 NEXT_PUBLIC_* 变量`);
  console.log(`  2. DEPLOY_BLOCK → 写入 app/api/team-rewards/total/route.ts`);
  console.log(`  3. 前端 Chain ID 切换为 8453`);
  console.log(`  4. Payout 注资（见上方 cast 命令）`);
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  DRY RUN 完成。确认参数无误后，去掉 DRY_RUN=true 再执行部署。");
  console.log("═══════════════════════════════════════════════════════════════\n");
  process.exit(0);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (process.env.DRY_RUN === "true") printParamsAndExit();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  VVVEco — Base Mainnet Deployment");
  console.log("═══════════════════════════════════════════════════════════════");

  // ── 私钥校验 ──────────────────────────────────────────────────────────────
  const rawKey = process.env.PRIVATE_KEY ?? "";
  if (!rawKey || rawKey === "your_private_key_here" || rawKey.length < 32) {
    console.error("\n❌  PRIVATE_KEY 未设置或仍为占位符。");
    console.error("    请在 .env 中填写真实私钥，再运行此脚本。");
    process.exit(1);
  }
  const deployerKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;

  // ── RPC ────────────────────────────────────────────────────────────────────
  const rpc = process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org";
  console.log(`  RPC       : ${rpc}`);

  const provider  = new ethers.JsonRpcProvider(rpc);
  const _wallet   = new ethers.Wallet(deployerKey, provider);
  const signer    = new NonceManager(_wallet);
  const deployer  = _wallet.address;
  console.log(`  Deployer  : ${deployer}`);

  // ── Chain ID 检查（防止误跑 Sepolia）──────────────────────────────────────
  const network = await provider.getNetwork();
  if (network.chainId !== CHAIN_ID) {
    console.error(`\n❌  RPC 返回 chainId=${network.chainId}，期望 8453 (Base Mainnet)。`);
    console.error("    请检查 BASE_MAINNET_RPC 配置。");
    process.exit(1);
  }
  console.log(`  Chain ID  : ${network.chainId} ✓ Base Mainnet`);

  // ── 余额检查 ───────────────────────────────────────────────────────────────
  const ethBal = await provider.getBalance(deployer);
  console.log(`  ETH bal   : ${ethers.formatEther(ethBal)} ETH`);
  if (ethBal < MIN_ETH_BAL) {
    console.error(`\n❌  余额不足 ${ethers.formatEther(MIN_ETH_BAL)} ETH，无法部署并初始化。`);
    process.exit(1);
  }

  // ── Owner 地址确认 ─────────────────────────────────────────────────────────
  if (deployer.toLowerCase() !== OWNER.toLowerCase()) {
    console.error(`\n❌  部署地址 ${deployer} 不是预期的 owner ${OWNER}。`);
    console.error("    请确认私钥正确，或修改脚本中的 OWNER 常量。");
    process.exit(1);
  }

  const deployedAtBlock = await provider.getBlockNumber();
  console.log(`  Start blk : ${deployedAtBlock}`);
  console.log("");

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1 — AerodromeAdapter
  // ─────────────────────────────────────────────────────────────────────────
  process.stdout.write("  [1/4] AerodromeAdapter  ... ");
  const adapter    = await deploy(signer, "AerodromeAdapter",
    AERO_ROUTER, VVV_TOKEN, WETH, AERO_FACTORY, STABLE
  );
  const adapterAddr = await adapter.getAddress();
  console.log(adapterAddr);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2 — VVVTreasury
  // constructor(address _vvvToken, address _router, address _weth, address _projectWallet)
  // ─────────────────────────────────────────────────────────────────────────
  process.stdout.write("  [2/4] VVVTreasury       ... ");
  const treasury    = await deploy(signer, "VVVTreasury",
    VVV_TOKEN, adapterAddr, WETH, PROJECT_WALLET
  );
  const treasuryAddr = await treasury.getAddress();
  console.log(treasuryAddr);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3 — VVVPayout
  // constructor(address _vvvToken, address _router, address _weth, address _feeWallet, uint256 _feePercent)
  // ─────────────────────────────────────────────────────────────────────────
  process.stdout.write("  [3/4] VVVPayout         ... ");
  const payout    = await deploy(signer, "VVVPayout",
    VVV_TOKEN, adapterAddr, WETH, FEE_WALLET, FEE_PERCENT
  );
  const payoutAddr = await payout.getAddress();
  console.log(payoutAddr);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4 — VVVEcoStaking
  // constructor(address _vvvToken, address _treasury, address _payout,
  //             address _pricePool, address _ethUsdFeed)
  // ─────────────────────────────────────────────────────────────────────────
  process.stdout.write("  [4/4] VVVEcoStaking     ... ");
  const staking    = await deploy(signer, "VVVEcoStaking",
    VVV_TOKEN, treasuryAddr, payoutAddr, PRICE_POOL, ETH_USD_FEED
  );
  const stakingAddr = await staking.getAddress();
  console.log(stakingAddr);

  // ─────────────────────────────────────────────────────────────────────────
  // Post-deployment configuration
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n─── 部署后配置 ──────────────────────────────────────────────");

  // Treasury → bind Staking
  process.stdout.write("  Treasury.setStakingContract  ... ");
  await (await treasury.setStakingContract(stakingAddr)).wait();
  console.log("✓");

  // Payout → bind Staking
  process.stdout.write("  Payout.setStakingContract    ... ");
  await (await payout.setStakingContract(stakingAddr)).wait();
  console.log("✓");

  // Staking → set root referrer
  process.stdout.write("  Staking.setRootReferrer      ... ");
  await (await staking.setRootReferrer(ROOT_REFERRER)).wait();
  console.log("✓");

  // ─────────────────────────────────────────────────────────────────────────
  // On-chain verification
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n─── 链上状态验证 ─────────────────────────────────────────────");

  const chkOwner      = await staking.owner();
  const chkRoot       = await staking.rootReferrer();
  const chkPool       = await staking.pricePool();
  const chkFeed       = await staking.ethUsdFeed();
  const chkTreasury   = await staking.treasury();
  const chkPayout     = await staking.payout();
  const chkTStaking   = await treasury.stakingContract();
  const chkPStaking   = await payout.stakingContract();
  const chkPRouter    = await payout.router();
  const chkTRouter    = await treasury.router();
  const chkEthBal     = await payout.ethBalance();
  const chkPrice      = await staking.getLatestPrice().catch(() => null);

  const checks: [boolean, string, string][] = [
    [chkOwner.toLowerCase() === OWNER.toLowerCase(),          "staking.owner()",            chkOwner],
    [chkRoot.toLowerCase() === ROOT_REFERRER.toLowerCase(),   "staking.rootReferrer()",     chkRoot],
    [chkPool.toLowerCase() === PRICE_POOL.toLowerCase(),      "staking.pricePool()",        chkPool],
    [chkFeed.toLowerCase() === ETH_USD_FEED.toLowerCase(),    "staking.ethUsdFeed()",       chkFeed],
    [chkTreasury.toLowerCase() === treasuryAddr.toLowerCase(),"staking.treasury()",         chkTreasury],
    [chkPayout.toLowerCase() === payoutAddr.toLowerCase(),    "staking.payout()",           chkPayout],
    [chkTStaking.toLowerCase() === stakingAddr.toLowerCase(), "treasury.stakingContract()", chkTStaking],
    [chkPStaking.toLowerCase() === stakingAddr.toLowerCase(), "payout.stakingContract()",   chkPStaking],
    [chkPRouter.toLowerCase() === adapterAddr.toLowerCase(),  "payout.router()",            chkPRouter],
    [chkTRouter.toLowerCase() === adapterAddr.toLowerCase(),  "treasury.router()",          chkTRouter],
    [true,                                                     "payout.ethBalance()",        ethers.formatEther(chkEthBal) + " ETH ⚠️ 需手动 depositETH"],
    [chkPrice !== null && chkPrice > 0n,                      "staking.getLatestPrice()",   chkPrice ? ethers.formatEther(chkPrice) + " USD/VVV" : "FAILED"],
  ];

  let allOk = true;
  for (const [ok, label, val] of checks) {
    console.log(`  ${ok ? "✅" : "❌"}  ${label.padEnd(32)} = ${val}`);
    if (!ok) allOk = false;
  }

  assert(allOk, "一项或多项验证失败，请检查上方输出");

  // ─────────────────────────────────────────────────────────────────────────
  // Save deployments/base-mainnet.json
  // ─────────────────────────────────────────────────────────────────────────
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const deployment = {
    network:         "base-mainnet",
    chainId:         8453,
    deployedAt:      new Date().toISOString(),
    deployedAtBlock,
    deployer,
    contracts: {
      AerodromeAdapter: adapterAddr,
      VVVTreasury:      treasuryAddr,
      VVVPayout:        payoutAddr,
      VVVEcoStaking:    stakingAddr,
    },
    externalContracts: {
      VVVToken:       VVV_TOKEN,
      WETH:           WETH,
      AeroRouter:     AERO_ROUTER,
      AeroFactory:    AERO_FACTORY,
      PricePool:      PRICE_POOL,
      EthUsdFeed:     ETH_USD_FEED,
    },
    config: {
      projectWallet: PROJECT_WALLET,
      feeWallet:     FEE_WALLET,
      rootReferrer:  ROOT_REFERRER,
      feePercent:    FEE_PERCENT,
    },
    warnings: {
      payoutFunded: false,
      payoutNote:   "Run: cast send <payoutAddr> 'depositETH()' --value 0.5ether before going live",
    },
  };

  const outPath = path.join(deploymentsDir, "base-mainnet.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\n  📄  Saved → deployments/base-mainnet.json`);

  // ─────────────────────────────────────────────────────────────────────────
  // Print NEXT_PUBLIC env vars
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  ✅  部署完成");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`
⚠️  请将以下内容 手动复制 到 .env.local（脚本不自动覆盖）:

# ── Base Mainnet 合约地址 ───────────────────────────────────
NEXT_PUBLIC_VVV_TOKEN=${VVV_TOKEN}
NEXT_PUBLIC_VVECO_STAKING=${stakingAddr}
NEXT_PUBLIC_VVECO_PAYOUT=${payoutAddr}
NEXT_PUBLIC_VVECO_TREASURY=${treasuryAddr}
NEXT_PUBLIC_ROOT_REFERRER_ADDRESS=${ROOT_REFERRER}
# ──────────────────────────────────────────────────────────

完成后重启 Next.js（npm run build && npm run start）。
`);

  console.log("📋  部署后手动操作清单:");
  console.log("  1. 更新 .env.local（见上方）");
  console.log("  2. 前端切换 Chain ID: 8453 (Base Mainnet)");
  console.log(`  3. DEPLOY_BLOCK → ${deployedAtBlock}（写入 app/api/team-rewards/total/route.ts）`);
  console.log("");
  console.log("  ⚠️  【必须完成，否则 claim 进队列】Payout 注资:");
  console.log(`  cast send ${payoutAddr} "depositETH()" \\`);
  console.log(`    --value 0.5ether \\`);
  console.log(`    --private-key $PRIVATE_KEY \\`);
  console.log(`    --rpc-url $BASE_MAINNET_RPC`);
}

main().catch(e => {
  console.error("\n❌  部署失败:", e.message ?? e);
  process.exit(1);
});
