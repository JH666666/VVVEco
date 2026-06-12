import { ethers } from "ethers";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const RPC = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
const STAKING = process.env.NEXT_PUBLIC_VVECO_STAKING ?? "";
const abi = JSON.parse(fs.readFileSync("artifacts/contracts/VVVEcoStaking.sol/VVVEcoStaking.json","utf8")).abi;

const addrs = [
  ["0x27d9 (claimer)",  "0x27d92fee2043af309de7a039a479e71f93668b40"],
  ["0xdf78 (gen1)",     "0xdf785748128af0d618eccbcb4bf0e765bc3791f0"],
  ["0x7979 (gen2)",     "0x7979de0d1c1e5fa315902465ee7f2f0c0a42a907"],
  ["0x6c0e (gen3)",     "0x6c0ebd2027fa3512b3072178adfc0bfc91d16962"],
  ["0xbd79 (root)",     "0xbd7928a836c9d7eaa5fbeeb0c1ba9f2fb4c852f3"],
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const c = new ethers.Contract(STAKING, abi, provider);
  for (const [label, addr] of addrs) {
    const u = await c.users(addr);
    console.log(`${label}: level=${u.level}, referrer=${u.referrer.slice(0,10)}...`);
  }
}
main().catch(console.error);
