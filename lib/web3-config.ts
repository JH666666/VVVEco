import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { http, createConfig, createStorage, fallback } from "wagmi";
import { baseSepolia, hardhat } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: [injectedWallet, walletConnectWallet],
    },
  ],
  {
    appName: "VVVeco",
    projectId,
  }
);

export const config = createConfig({
  connectors,
  chains: [baseSepolia, hardhat],
  transports: {
    [baseSepolia.id]: fallback([
      http("https://sepolia.base.org"),
      http("https://base-sepolia-rpc.publicnode.com"),
      http("https://84532.rpc.thirdweb.com"),
    ]),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  }),
  ssr: false,
});
