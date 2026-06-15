import { NextResponse } from "next/server";
import { createPublicClient, http, formatEther, parseAbiItem } from "viem";
import { base } from "viem/chains";

const PAYOUT_ADDR  = (process.env.NEXT_PUBLIC_VVECO_PAYOUT  || "0xc9102200271245660AB1C640CEB502936BDe04E1") as `0x${string}`;
const STAKING_ADDR = (process.env.NEXT_PUBLIC_VVECO_STAKING || "0xc451DdCdDbd9e8700E71960d190b55fE1eD57B34") as `0x${string}`;
// Chainlink ETH/USD on Base Mainnet
const ETH_USD_FEED = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70" as `0x${string}`;
// Payout contract deployed at block 47346661 on Base Mainnet
const DEPLOY_BLOCK = BigInt(process.env.PAYOUT_DEPLOY_BLOCK ?? "47346661");
const PAGE_SIZE    = 9000n; // public RPC max is 10k; stay under

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_MAINNET_RPC ?? "https://mainnet.base.org"),
});

const PAYOUT_ABI = [
  { name: "pendingNetForUser", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "pendingFeeForUser", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "ethBalance",        type: "function", stateMutability: "view", inputs: [],                               outputs: [{ type: "uint256" }] },
] as const;

const STAKING_PRICE_ABI = [
  { name: "getLatestPrice", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const CHAINLINK_ABI = [
  {
    name: "latestRoundData", type: "function", stateMutability: "view", inputs: [],
    outputs: [
      { name: "roundId",         type: "uint80"  },
      { name: "answer",          type: "int256"  },
      { name: "startedAt",       type: "uint256" },
      { name: "updatedAt",       type: "uint256" },
      { name: "answeredInRound", type: "uint80"  },
    ],
  },
] as const;

export async function GET() {
  try {
    // Paginate getLogs in 9k-block chunks (public RPC limit is 10k)
    const currentBlock = await client.getBlockNumber();
    const payoutEvent  = parseAbiItem("event PayoutQueued(address indexed user, uint256 netVvv, uint256 feeVvv, string reason)");
    const allLogs: Awaited<ReturnType<typeof client.getLogs>> = [];
    for (let from = DEPLOY_BLOCK; from <= currentBlock; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1n < currentBlock ? from + PAGE_SIZE - 1n : currentBlock;
      const chunk = await client.getLogs({ address: PAYOUT_ADDR, event: payoutEvent, fromBlock: from, toBlock: to }).catch(() => []);
      allLogs.push(...chunk);
    }

    const [ethBalRes, vvvPriceRes, ethUsdRes] = await Promise.allSettled([
      client.readContract({ address: PAYOUT_ADDR,  abi: PAYOUT_ABI,        functionName: "ethBalance"      }),
      client.readContract({ address: STAKING_ADDR, abi: STAKING_PRICE_ABI, functionName: "getLatestPrice"  }),
      client.readContract({ address: ETH_USD_FEED, abi: CHAINLINK_ABI,     functionName: "latestRoundData" }),
    ]);

    const logs        = allLogs;
    const ethBalance  = ethBalRes.status  === "fulfilled" ? (ethBalRes.value  as bigint) : 0n;
    const vvvUsdPrice = vvvPriceRes.status === "fulfilled" ? (vvvPriceRes.value as bigint) : 0n;
    const ethUsdAnswer = ethUsdRes.status === "fulfilled"
      ? ((ethUsdRes.value as [bigint, bigint, bigint, bigint, bigint])[1])
      : 0n;

    // Block timestamps (batch, tolerate failures)
    const uniqueBlocks = [...new Set(logs.map(l => l.blockNumber))];
    const blockTimes   = new Map<bigint, number>();
    if (uniqueBlocks.length > 0) {
      const bRes = await Promise.allSettled(uniqueBlocks.map(bn => client.getBlock({ blockNumber: bn })));
      bRes.forEach((r, i) => {
        if (r.status === "fulfilled") blockTimes.set(uniqueBlocks[i], Number(r.value.timestamp));
      });
    }

    // Group logs by user
    type LogItem = (typeof logs)[number];
    const userMap = new Map<string, LogItem[]>();
    for (const log of logs) {
      const user = (log.args as { user?: string }).user?.toLowerCase() ?? "";
      if (!user) continue;
      if (!userMap.has(user)) userMap.set(user, []);
      userMap.get(user)!.push(log);
    }

    // Read current pending for each user
    const userAddrs    = Array.from(userMap.keys());
    const pendingBatch = await Promise.allSettled(
      userAddrs.map(u =>
        Promise.allSettled([
          client.readContract({ address: PAYOUT_ADDR, abi: PAYOUT_ABI, functionName: "pendingNetForUser", args: [u as `0x${string}`] }),
          client.readContract({ address: PAYOUT_ADDR, abi: PAYOUT_ABI, functionName: "pendingFeeForUser", args: [u as `0x${string}`] }),
        ])
      )
    );

    const items = userAddrs.map((user, i) => {
      let netVvv = 0n;
      let feeVvv = 0n;
      const pr = pendingBatch[i];
      if (pr.status === "fulfilled") {
        const [nr, fr] = pr.value;
        netVvv = nr.status === "fulfilled" ? (nr.value as bigint) : 0n;
        feeVvv = fr.status === "fulfilled" ? (fr.value as bigint) : 0n;
      }
      const userLogs = userMap.get(user)!;
      return {
        user,
        netVvv:  formatEther(netVvv),
        feeVvv:  formatEther(feeVvv),
        status:  (netVvv + feeVvv) > 0n ? "pending" : "flushed",
        events:  userLogs
          .map(l => ({
            txHash:      l.transactionHash ?? "",
            blockNumber: Number(l.blockNumber),
            timestamp:   blockTimes.get(l.blockNumber) ?? 0,
            netVvv:      formatEther((l.args as { netVvv?: bigint }).netVvv ?? 0n),
            feeVvv:      formatEther((l.args as { feeVvv?: bigint }).feeVvv ?? 0n),
            reason:      (l.args as { reason?: string }).reason ?? "",
          }))
          .sort((a, b) => b.blockNumber - a.blockNumber),
      };
    });

    items.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return 0;
    });

    const pendingItems = items.filter(i => i.status === "pending");
    const totalNetVvv  = pendingItems.reduce((s, i) => s + parseFloat(i.netVvv), 0);
    const totalFeeVvv  = pendingItems.reduce((s, i) => s + parseFloat(i.feeVvv), 0);

    // Estimate ETH needed (float math is fine for display)
    let ethNeeded = "0";
    if (vvvUsdPrice > 0n && ethUsdAnswer > 0n) {
      const vvvUsd = Number(formatEther(vvvUsdPrice));          // VVV/USD e.g. 0.016
      const ethUsd = Number(ethUsdAnswer) / 1e8;                // ETH/USD e.g. 2500
      const usdNeeded = (totalNetVvv + totalFeeVvv) * vvvUsd;
      ethNeeded = (usdNeeded / ethUsd).toFixed(6);
    }

    return NextResponse.json({
      ethBalance:       formatEther(ethBalance),
      ethNeeded,
      vvvUsdPrice:      Number(formatEther(vvvUsdPrice)).toFixed(4),
      pendingUserCount: pendingItems.length,
      totalNetVvv:      totalNetVvv.toFixed(4),
      totalFeeVvv:      totalFeeVvv.toFixed(4),
      items,
    });
  } catch (e) {
    console.error("[payout-queue] GET error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
