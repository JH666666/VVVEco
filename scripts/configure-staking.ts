import { ethers, NonceManager } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const RPC          = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
const NEW_STAKING  = "0xC42465EBAcb0Fd6e6793f03041267072f5bF1A06";
const TREASURY     = process.env.NEXT_PUBLIC_VVECO_TREASURY ?? "";
const PAYOUT       = process.env.NEXT_PUBLIC_VVECO_PAYOUT   ?? "";
const ROOT_ADDR    = process.env.NEXT_PUBLIC_ROOT_REFERRER_ADDRESS ?? "";
const rawKey       = process.env.PRIVATE_KEY ?? "";
const DEPLOYER_KEY = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;

function art(name: string) {
  const p = path.join("/Users/jianghu/VVVEco-cursor/VVV_Eco_Project/artifacts/contracts", `${name}.sol/${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const _wallet  = new ethers.Wallet(DEPLOYER_KEY, provider);
  const signer   = new NonceManager(_wallet);

  console.log("  Treasury.setStakingContract ...");
  const treasury = new ethers.Contract(TREASURY, art("VVVTreasury").abi, signer);
  await (await treasury.setStakingContract(NEW_STAKING)).wait();
  console.log("  ✓ Treasury done");

  console.log("  Payout.setStakingContract ...");
  const payout = new ethers.Contract(PAYOUT, art("VVVPayout").abi, signer);
  await (await payout.setStakingContract(NEW_STAKING)).wait();
  console.log("  ✓ Payout done");

  if (ROOT_ADDR && ROOT_ADDR !== ethers.ZeroAddress) {
    console.log("  setRootReferrer ...");
    const staking = new ethers.Contract(NEW_STAKING, art("VVVEcoStaking").abi, signer);
    await (await staking.setRootReferrer(ROOT_ADDR)).wait();
    console.log("  ✓ rootReferrer done");
  }

  console.log("\n✅ 配置完成");
}

main().catch(e => { console.error("❌", e.message ?? e); process.exit(1); });
