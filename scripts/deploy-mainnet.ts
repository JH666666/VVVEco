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
const ROOT_REFERRER  = "0x58940A90bc63E72F7F69ad62CA5C776D696b3F5e"; // V2: 独立 Root Referrer 钱包
const OWNER          = "0x31b265Fd2db6F0445B9d92306a0bf1A313B0aD3A"; // V2: 独立 Owner 钱包（与 deployer 分离）

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
  console.log("  durationRates    : 1d→7‰  15d→8‰  30d→9‰  60d→10‰ (/day)");
  console.log("  inviteRates      : gen1=10%  gen2=5%  gen3=3%");
  console.log("  levelRates       : V1=3% V2=4% V3=5% V4=6% V5=7% V6=8% V7=9% V8=10%");
  console.log("  levelThresholds  : V1≥$0 V2≥$10K V3≥$20K V4≥$30K V5≥$50K V6≥$100K V7≥$150K V8≥$200K");
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
  console.log("── V2 安全架构说明 ───────────────────────────────────────────\n");
  console.log("  Deploy Wallet = 仅用于部署 + 初始化，部署后自动转让所有权");
  console.log(`  Owner Wallet  = ${OWNER}`);
  console.log("    ↑ 部署完成后，4 个合约所有权均转给此地址");
  console.log("  生产服务器禁止保存任何形式的 PRIVATE_KEY\n");
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

  // ── V2: deployer ≠ owner，此处仅打印部署方与最终 owner，不 abort ────────────
  console.log(`  Owner     : ${OWNER}  (部署完成后所有权转给此地址)`);
  if (deployer.toLowerCase() === OWNER.toLowerCase()) {
    console.warn("\n⚠️  WARNING: Deploy Wallet 与 Owner Wallet 相同。");
    console.warn("    V2 安全最佳实践：建议使用独立的 Deploy Wallet。");
    console.warn("    继续部署...\n");
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

  // Staking → set root referrer (must happen before transferOwnership)
  process.stdout.write("  Staking.setRootReferrer      ... ");
  await (await staking.setRootReferrer(ROOT_REFERRER)).wait();
  console.log("✓");

  // ── V2: Transfer ownership of all contracts from deployer to OWNER ────────
  console.log("\n─── 转让所有权（deployer → Owner）───────────────────────────");

  process.stdout.write("  Staking.transferOwnership    ... ");
  await (await staking.transferOwnership(OWNER)).wait();
  console.log(`✓  → ${OWNER}`);

  process.stdout.write("  Treasury.transferOwnership   ... ");
  await (await treasury.transferOwnership(OWNER)).wait();
  console.log(`✓  → ${OWNER}`);

  process.stdout.write("  Payout.transferOwnership     ... ");
  await (await payout.transferOwnership(OWNER)).wait();
  console.log(`✓  → ${OWNER}`);

  process.stdout.write("  Adapter.transferOwnership    ... ");
  await (await adapter.transferOwnership(OWNER)).wait();
  console.log(`✓  → ${OWNER}`);

  // ─────────────────────────────────────────────────────────────────────────
  // On-chain verification
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n─── 链上状态验证 ─────────────────────────────────────────────");

  const chkOwner      = await staking.owner();
  const chkTOwner     = await treasury.owner();
  const chkPOwner     = await payout.owner();
  const chkAOwner     = await adapter.owner();
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
    // ── Ownership (all must point to OWNER, not deployer) ──────────────────
    [chkOwner.toLowerCase()  === OWNER.toLowerCase(), "staking.owner()",            chkOwner],
    [chkTOwner.toLowerCase() === OWNER.toLowerCase(), "treasury.owner()",           chkTOwner],
    [chkPOwner.toLowerCase() === OWNER.toLowerCase(), "payout.owner()",             chkPOwner],
    [chkAOwner.toLowerCase() === OWNER.toLowerCase(), "adapter.owner()",            chkAOwner],
    // ── Configuration ────────────────────────────────────────────────────────
    [chkRoot.toLowerCase()   === ROOT_REFERRER.toLowerCase(),  "staking.rootReferrer()",     chkRoot],
    [chkPool.toLowerCase()   === PRICE_POOL.toLowerCase(),     "staking.pricePool()",        chkPool],
    [chkFeed.toLowerCase()   === ETH_USD_FEED.toLowerCase(),   "staking.ethUsdFeed()",       chkFeed],
    [chkTreasury.toLowerCase() === treasuryAddr.toLowerCase(), "staking.treasury()",         chkTreasury],
    [chkPayout.toLowerCase()   === payoutAddr.toLowerCase(),   "staking.payout()",           chkPayout],
    [chkTStaking.toLowerCase() === stakingAddr.toLowerCase(),  "treasury.stakingContract()", chkTStaking],
    [chkPStaking.toLowerCase() === stakingAddr.toLowerCase(),  "payout.stakingContract()",   chkPStaking],
    [chkPRouter.toLowerCase()  === adapterAddr.toLowerCase(),  "payout.router()",            chkPRouter],
    [chkTRouter.toLowerCase()  === adapterAddr.toLowerCase(),  "treasury.router()",          chkTRouter],
    [true,                                                      "payout.ethBalance()",        ethers.formatEther(chkEthBal) + " ETH ⚠️ Owner 需手动 depositETH"],
    [chkPrice !== null && chkPrice > 0n,                        "staking.getLatestPrice()",   chkPrice ? ethers.formatEther(chkPrice) + " USD/VVV" : "FAILED"],
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
    version:         "v2",
    deployedAt:      new Date().toISOString(),
    deployedAtBlock,
    deployWallet:    deployer,
    ownerWallet:     OWNER,
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
    security: {
      ownershipTransferred: true,
      deployWalletHasNoOwnership: true,
      privateKeyNeverOnServer: true,
    },
    warnings: {
      payoutFunded: false,
      payoutNote:   `Owner (${OWNER}) must call depositETH() on Payout contract before users can claim`,
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
⚠️  请将以下内容 手动复制 到服务器 .env（通过宝塔文件管理器，不要提交 git）:

# ── V2 Base Mainnet 合约地址 ────────────────────────────────
NEXT_PUBLIC_VVV_TOKEN=${VVV_TOKEN}
NEXT_PUBLIC_VVECO_STAKING=${stakingAddr}
NEXT_PUBLIC_VVECO_PAYOUT=${payoutAddr}
NEXT_PUBLIC_VVECO_TREASURY=${treasuryAddr}
NEXT_PUBLIC_ADMIN_OWNER_ADDRESS=${OWNER}
NEXT_PUBLIC_ROOT_REFERRER_ADDRESS=${ROOT_REFERRER}
# ───────────────────────────────────────────────────────────
# ⚠️  绝对禁止在服务器 .env 中保存 PRIVATE_KEY
# ───────────────────────────────────────────────────────────

完成后重启 Next.js（npm run build && npm run start）。
`);

  console.log("📋  V2 部署后操作清单:");
  console.log("  ✅ 1. Staking/Treasury/Payout/Adapter 所有权已自动转给 Owner");
  console.log(`  ✅ 2. RootReferrer 已设置 → ${ROOT_REFERRER}`);
  console.log("  3. 更新 lib/contract-hooks.ts fallback 地址（见上方新地址）");
  console.log("  4. 更新 lib/chain-read.ts STAKING_ADDR fallback");
  console.log("  5. 更新 app/api/team-rewards/total/route.ts：");
  console.log(`       STAKING fallback → ${stakingAddr}`);
  console.log(`       DEPLOY_BLOCK     → ${deployedAtBlock}n`);
  console.log("  6. 更新 app/api/admin/payout-queue/route.ts fallback 地址");
  console.log("  7. 更新服务器 .env（见上方）→ 宝塔文件管理器操作");
  console.log("  8. git commit && git push → 服务器 git pull + npm run build + pm2 restart");
  console.log("");
  console.log("  ⚠️  【Owner 钱包操作，必须完成，否则 claim 进队列】Payout 注资:");
  console.log(`     合约地址: ${payoutAddr}`);
  console.log(`     函数: depositETH()`);
  console.log(`     需发送 ETH value 以注资（Owner 钱包 ${OWNER} 操作）`);
}

main().catch(e => {
  console.error("\n❌  部署失败:", e.message ?? e);
  process.exit(1);
});
