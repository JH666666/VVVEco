/**
 * 诊断某地址每个订单的链上待领取 / 已领取,判断领取是否真的上链。
 * 用法（服务器项目根目录）：
 *   npx tsx scripts/check-pending.ts 0xd31B3fFb46c7a20B37eb8C236D05f62ae733662b
 */
import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const USER = (process.argv[2] ?? "").trim() as `0x${string}`;
const STAKING = (
  process.env.NEXT_PUBLIC_VVECO_STAKING ?? "0x5ec768D99Cdc49a95E29811Ce97a313f294EBC64"
) as `0x${string}`;
const RPC = process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org";

const client = createPublicClient({ chain: base, transport: http(RPC) });

const ABI = [
  {
    name: "getPendingReward",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "u", type: "address" }, { name: "o", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getOrder",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "u", type: "address" }, { name: "o", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "vvvAmountIn", type: "uint256" },
          { name: "usdValue", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "duration", type: "uint256" },
          { name: "rate", type: "uint256" },
          { name: "isCoinBased", type: "bool" },
          { name: "isWithdrawn", type: "bool" },
          { name: "claimedAmount", type: "uint256" },
        ],
      },
    ],
  },
] as const;
const PRICE_ABI = [
  { name: "getLatestPrice", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

async function main() {
  if (!/^0x[a-fA-F0-9]{40}$/.test(USER)) {
    console.error("用法: npx tsx scripts/check-pending.ts <address>");
    process.exit(1);
  }
  const price = Number(await client.readContract({ address: STAKING, abi: PRICE_ABI, functionName: "getLatestPrice" })) / 1e18;
  console.log("地址:", USER);
  console.log("VVV/USD 价格:", price);
  console.log("");

  for (let i = 0; i < 40; i++) {
    let o: {
      usdValue: bigint; startTime: bigint; endTime: bigint; isCoinBased: boolean; isWithdrawn: boolean; claimedAmount: bigint;
    };
    try {
      o = (await client.readContract({ address: STAKING, abi: ABI, functionName: "getOrder", args: [USER, BigInt(i)] })) as never;
    } catch {
      console.log(`\n共 ${i} 个订单（orderId ${i} 已不存在）`);
      break;
    }
    const pending = (await client.readContract({ address: STAKING, abi: ABI, functionName: "getPendingReward", args: [USER, BigInt(i)] })) as bigint;
    const pv = Number(pending) / 1e18;
    const usd = Number(o.usdValue) / 1e18;
    const claimed = Number(o.claimedAmount) / 1e18;
    const start = new Date(Number(o.startTime) * 1000).toLocaleString("zh-CN", { hour12: false });
    console.log(
      `orderId ${i}: $${usd}  ${o.isCoinBased ? "币本位" : "金本位"}  开始 ${start}  已赎回=${o.isWithdrawn}`
    );
    console.log(
      `           链上已领取(claimedAmount)=${claimed}   链上待领取=${pv} VVV ≈ $${(pv * price).toFixed(4)}`
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
