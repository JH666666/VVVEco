async function main() {
  const { createPublicClient, http, parseAbi, formatEther } = await import('viem');
  const { baseSepolia } = await import('viem/chains');

  const client = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });
  const ROUTER = '0xE788E01af2750FE9Ba8a3c47B6a2EC169d165E8d' as `0x${string}`;
  const VVV    = '0xf857F4BaeF1503262c20156457e1336BA37BA495' as `0x${string}`;
  const PAYOUT = '0x29C15f321f65f2b18D015bEce02D58448Af4C8B8' as `0x${string}`;

  const [ethRouter, vvvRouter, ethPayout] = await Promise.all([
    client.getBalance({ address: ROUTER }),
    client.readContract({ address: VVV, abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [ROUTER] }),
    client.getBalance({ address: PAYOUT }),
  ]);
  console.log('MockRouter ETH:', formatEther(ethRouter));
  console.log('MockRouter VVV:', formatEther(vvvRouter));
  console.log('VVVPayout  ETH:', formatEther(ethPayout));
}
main().catch(console.error);
