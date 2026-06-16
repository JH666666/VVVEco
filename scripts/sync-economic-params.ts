/**
 * scripts/sync-economic-params.ts
 *
 * VVVEco Mainnet V1 Economic Parameters 一键同步脚本
 *
 * 执行顺序：
 *   1. 读取链上当前值并打印（viem publicClient）
 *   2. 依次调用 setInviteRate (3 笔) + setLevelRate (8 笔)（ethers.js wallet）
 *   3. 链上全部成功后，PUT /api/config/reward 更新 DB
 *   4. 再次读取链上值验证
 *   5. 输出最终结果对比表
 *
 * 运行：
 *   npx tsx scripts/sync-economic-params.ts
 */

import { ethers, NonceManager } from "ethers";
import { execSync } from "child_process";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

// ── 目标参数 ───────────────────────────────────────────────────────────────────

const TARGET_INVITE_RATES = [10, 5, 3]; // gen1, gen2, gen3
const TARGET_LEVEL_RATES  = [3, 4, 5, 6, 7, 8, 9, 10]; // V1–V8

// ── 合约地址 ───────────────────────────────────────────────────────────────────

const STAKING_ADDR = "0xc451DdCdDbd9e8700E71960d190b55fE1eD57B34" as const;
const OWNER_ADDR   = "0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3";
const CHAIN_ID     = 8453n;

const STAKING_ABI_ETHERS = [
  "function setInviteRate(uint256 gen, uint256 rate) external",
  "function setLevelRate(uint8 level, uint256 rate) external",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function castRead(addr: string, fn: string, arg: number, rpcUrl: string): number {
  const out = execSync(
    `cast call ${addr} "${fn}(uint256)(uint256)" ${arg} --rpc-url ${rpcUrl}`,
    { encoding: "utf8" }
  ).trim();
  return parseInt(out, 10);
}

function readCurrentValues(addr: string, rpcUrl: string) {
  process.stdout.write("inviteRates...");
  const inv = [1, 2, 3].map(g => castRead(addr, "inviteRates", g, rpcUrl));
  process.stdout.write(" levelRates...");
  const lvl = Array.from({ length: 8 }, (_, i) => castRead(addr, "levelRates", i + 1, rpcUrl));
  return { inviteRates: inv, levelRates: lvl };
}

function printTable(label: string, invite: number[], levels: number[]) {
  console.log(`\n── ${label} ─────────────────────────────`);
  console.log("  邀请奖励:");
  invite.forEach((v, i) => console.log(`    Gen${i + 1} = ${v}%`));
  console.log("  等级系数:");
  levels.forEach((v, i) => console.log(`    V${i + 1}  = ${v}%`));
}

function checkMatch(current: number[], target: number[], name: string) {
  const ok = target.every((v, i) => v === current[i]);
  if (!ok) {
    console.error(`\n  ❌ ${name} 不匹配:`);
    target.forEach((v, i) => {
      if (v !== current[i]) console.error(`     index ${i + 1}: 期望 ${v}，实际 ${current[i]}`);
    });
  }
  return ok;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const rawKey = process.env.PRIVATE_KEY ?? "";
  if (!rawKey || rawKey.length < 32) {
    console.error("❌  PRIVATE_KEY 未设置，请在 .env 中配置");
    process.exit(1);
  }
  const key     = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  const rpcUrl  = process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org";
  const apiBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet   = new NonceManager(new ethers.Wallet(key, provider));
  const staking  = new ethers.Contract(STAKING_ADDR, STAKING_ABI_ETHERS, wallet);

  console.log("══════════════════════════════════════════════════");
  console.log("  VVVEco Mainnet V1 Economic Parameters 同步脚本");
  console.log("══════════════════════════════════════════════════");
  const signerAddr = await wallet.getAddress();
  console.log(`  RPC     : ${rpcUrl}`);
  console.log(`  Signer  : ${signerAddr}`);
  console.log(`  API     : ${apiBase}`);

  // 链 ID 校验
  const network = await provider.getNetwork();
  if (network.chainId !== CHAIN_ID) {
    console.error(`\n❌  chainId=${network.chainId}，期望 8453 (Base Mainnet)`);
    process.exit(1);
  }

  // Owner 校验
  if (signerAddr.toLowerCase() !== OWNER_ADDR.toLowerCase()) {
    console.error(`\n❌  当前地址 ${signerAddr} 不是合约 Owner ${OWNER_ADDR}`);
    process.exit(1);
  }

  // ── 1. 读取当前链上值 ───────────────────────────────────────────────────────
  process.stdout.write("\n  [0] 读取当前链上值 ... ");
  const before = readCurrentValues(STAKING_ADDR, rpcUrl);
  console.log(" 完成");
  printTable("当前链上值", before.inviteRates, before.levelRates);

  // ── 2. 写入邀请奖励 (最多 3 笔) ───────────────────────────────────────────
  console.log("\n  [1/2] 写入 inviteRates ...");
  for (let gen = 1; gen <= 3; gen++) {
    const rate = TARGET_INVITE_RATES[gen - 1];
    const cur  = before.inviteRates[gen - 1];
    if (cur === rate) {
      console.log(`    Gen${gen}: 已是 ${rate}%，跳过`);
      continue;
    }
    process.stdout.write(`    Gen${gen}: ${cur}% → ${rate}% ... `);
    try {
      const tx = await staking.setInviteRate(gen, rate);
      await tx.wait();
      console.log(`✓  tx: ${tx.hash}`);
    } catch (e: unknown) {
      if (String((e as any)?.error?.message ?? (e as any)?.message ?? "").includes("already known")) {
        console.log("✓ (tx 已在 mempool，等待打包...)");
        await new Promise(r => setTimeout(r, 6000));
      } else { throw e; }
    }
  }

  // ── 3. 写入等级系数 (最多 8 笔) ───────────────────────────────────────────
  console.log("\n  [2/2] 写入 levelRates ...");
  for (let level = 1; level <= 8; level++) {
    const rate = TARGET_LEVEL_RATES[level - 1];
    const cur  = before.levelRates[level - 1];
    if (cur === rate) {
      console.log(`    V${level}: 已是 ${rate}%，跳过`);
      continue;
    }
    process.stdout.write(`    V${level}: ${cur}% → ${rate}% ... `);
    try {
      const tx = await staking.setLevelRate(level, rate);
      await tx.wait();
      console.log(`✓  tx: ${tx.hash}`);
    } catch (e: unknown) {
      if (String((e as any)?.error?.message ?? (e as any)?.message ?? "").includes("already known")) {
        console.log("✓ (tx 已在 mempool，等待打包...)");
        await new Promise(r => setTimeout(r, 6000));
      } else { throw e; }
    }
  }

  // ── 4. 验证链上结果 ────────────────────────────────────────────────────────
  process.stdout.write("\n  [验证] 读取链上最新值 ... ");
  const after = readCurrentValues(STAKING_ADDR, rpcUrl);
  console.log(" 完成");

  const inviteOk = checkMatch(after.inviteRates, TARGET_INVITE_RATES, "inviteRates");
  const levelOk  = checkMatch(after.levelRates,  TARGET_LEVEL_RATES,  "levelRates");

  if (!inviteOk || !levelOk) {
    console.error("\n❌  链上验证失败，停止更新 DB");
    process.exit(1);
  }
  console.log("  ✅ 链上值已全部匹配目标");

  // ── 5. 更新 DB ─────────────────────────────────────────────────────────────
  process.stdout.write("\n  [DB] 读取当前 reward 配置 ... ");
  let currentReward: Record<string, unknown> = {};
  try {
    const res = await fetch(`${apiBase}/api/config/reward`);
    if (res.ok) currentReward = await res.json();
    console.log("完成");
  } catch {
    console.log("失败（服务器未运行？），将使用默认值继续");
  }

  process.stdout.write("  [DB] PUT /api/config/reward ... ");
  try {
    const payload = {
      generationRates:  TARGET_INVITE_RATES,
      periodRates:      (currentReward.periodRates  as number[])   ?? [0.7, 0.8, 0.9, 1.0],
      periodDurations:  (currentReward.periodDurations as number[]) ?? [7, 15, 30, 60],
      periodUnits:      (currentReward.periodUnits  as string[])   ?? ["day","day","day","day"],
    };
    const res = await fetch(`${apiBase}/api/config/reward`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log("✓");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\n  ⚠️  DB 更新失败: ${msg}`);
    console.error("  链上已成功，请手动在后台重新保存邀请奖励设置");
  }

  // ── 6. 最终对比表 ──────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════");
  console.log("  最终结果");
  console.log("══════════════════════════════════════════════════");
  console.log("\n  邀请奖励：");
  console.log("  ┌──────┬──────────┬──────────┐");
  console.log("  │ 代数 │ 目标     │ 链上验证 │");
  console.log("  ├──────┼──────────┼──────────┤");
  ["Gen1","Gen2","Gen3"].forEach((g, i) => {
    const target = TARGET_INVITE_RATES[i];
    const chain  = after.inviteRates[i];
    const status = chain === target ? "✅" : "❌";
    console.log(`  │ ${g.padEnd(4)} │ ${String(target+"%").padEnd(8)} │ ${status} ${String(chain+"%").padEnd(4)} │`);
  });
  console.log("  └──────┴──────────┴──────────┘");

  console.log("\n  等级系数：");
  console.log("  ┌──────┬──────────┬──────────┐");
  console.log("  │ 等级 │ 目标     │ 链上验证 │");
  console.log("  ├──────┼──────────┼──────────┤");
  TARGET_LEVEL_RATES.forEach((target, i) => {
    const chain  = after.levelRates[i];
    const status = chain === target ? "✅" : "❌";
    console.log(`  │ V${i+1}   │ ${String(target+"%").padEnd(8)} │ ${status} ${String(chain+"%").padEnd(4)} │`);
  });
  console.log("  └──────┴──────────┴──────────┘");

  console.log("\n  ✅  同步完成。请刷新后台管理页面确认显示值。\n");
}

main().catch((e) => {
  console.error("\n❌  脚本异常:", e.message ?? e);
  process.exit(1);
});
