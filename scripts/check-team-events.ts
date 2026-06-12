async function main() {
  const RPC = "https://sepolia.base.org";
  const STAKING = "0xf1F2A60EdD2110a42F5Ec9d760348C0fB4Bc1659";
  const UPPER   = "0xbd7928a836c9d7eaa5fbeeb0c1ba9f2fb4c852f3";

  const topic0 = "0xe07f61c526a4ace6d1e5cad0a84eddbf8e2733ce8383b0b2f1d76f07fb1cab49";
  const topic1_upper = "0x000000000000000000000000" + UPPER.slice(2);

  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "eth_getLogs",
      params: [{ address: STAKING, topics: [topic0, topic1_upper], fromBlock: "0x28bc000" }],
    }),
  });
  const json = await res.json();
  const logs: Array<{ data: string; topics: string[]; blockNumber: string; transactionHash: string }> = json.result ?? [];
  console.log(`TeamRewardAccrued(recipient=0xbd79) 事件数: ${logs.length}`);
  let total = 0n;
  for (const log of logs) {
    const bonus = BigInt(log.data);
    total += bonus;
    const claimer = "0x" + log.topics[2].slice(26);
    console.log(`  bonus=${(Number(bonus)/1e18).toFixed(6)} VVV  claimer=${claimer}  block=${parseInt(log.blockNumber,16)}  tx=${log.transactionHash.slice(0,12)}...`);
  }
  console.log(`总计: ${(Number(total)/1e18).toFixed(6)} VVV`);
}
main().catch(console.error);

async function checkReferrer() {
  const { createPublicClient, http, parseAbi } = await import('viem');
  const { baseSepolia } = await import('viem/chains');
  const client = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });
  const STAKING = "0xf1F2A60EdD2110a42F5Ec9d760348C0fB4Bc1659" as `0x${string}`;
  const abi = parseAbi(["function users(address) view returns (address referrer, uint256 teamVolume7, uint8 level, uint256 rewardClaimed)"]);

  for (const [name, addr] of [
    ["0xbd79", "0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3"],
    ["0x7979", "0x7979de0d1c1E5fA315902465eE7F2f0C0a42a907"],
    ["0xdf78", "0xdF785748128AF0D618EcCBCB4bF0e765bC3791F0"],
  ] as const) {
    const r = await client.readContract({ address: STAKING, abi, functionName: "users", args: [addr as `0x${string}`] });
    console.log(`${name} → referrer=${r[0]}  level=${r[2]}  teamVol=${Number(r[1])/1e18}$`);
  }
}
checkReferrer().catch(console.error);
