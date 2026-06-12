import type { HardhatUserConfig } from "hardhat/config";
import hardhatEthersPlugin from "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const accounts = PRIVATE_KEY && PRIVATE_KEY !== "your_private_key_here"
  ? [`0x${PRIVATE_KEY.replace(/^0x/, "")}`]
  : [];

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  plugins: [hardhatEthersPlugin],
  networks: {
    hardhat: { type: "edr-simulated" },
    baseSepolia: {
      type: "http",
      url: process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
      chainId: 84532,
      accounts,
    },
  },
};

export default config;
