import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { http, createConfig, createStorage, fallback } from "wagmi";
import { base, hardhat } from "wagmi/chains";

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
  chains: [base, hardhat],
  transports: {
    [base.id]: fallback([
      http("https://mainnet.base.org"),
      http("https://base-rpc.publicnode.com"),
      http("https://8453.rpc.thirdweb.com"),
    ]),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  }),
  ssr: false,
});
