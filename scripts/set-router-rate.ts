import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { createWalletClient, createPublicClient, http, parseAbi, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

async function main() {
  const ROUTER = "0xE788E01af2750FE9Ba8a3c47B6a2EC169d165E8d" as `0x${string}`;
  const RPC    = "https://sepolia.base.org";

  const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY!}`);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) });

  const abi = parseAbi([
    "function ethPerVvv() view returns (uint256)",
    "function setRate(uint256) external",
  ]);

  const NEW_RATE = 10_000_000_000n; // 1e10 wei/VVV = 0.00000001 ETH/VVV
  const hash = await walletClient.writeContract({ address: ROUTER, abi, functionName: "setRate", args: [NEW_RATE] });
  console.log("setRate tx:", hash);
  await publicClient.waitForTransactionReceipt({ hash });

  const newRate = await publicClient.readContract({ address: ROUTER, abi, functionName: "ethPerVvv" });
  const ethBal  = await publicClient.getBalance({ address: ROUTER });
  const maxVvv  = Number(ethBal) / Number(newRate);
  console.log("新 rate:", newRate.toString(), "wei/VVV");
  console.log(`MockRouter ETH ${formatEther(ethBal)} → 最大可质押: ${maxVvv.toFixed(0)} VVV (~$${(maxVvv * 0.15).toFixed(0)} USD)`);
}
main().catch(console.error);
