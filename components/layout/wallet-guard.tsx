"use client";

import { useAccount } from "wagmi";
import { WalletButton } from "@/components/layout/wallet-button";
import { Wallet } from "lucide-react";

interface WalletGuardProps {
  children: React.ReactNode;
}

export function WalletGuard({ children }: WalletGuardProps) {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Wallet className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">请先连接钱包</h2>
          <p className="text-sm text-muted-foreground">连接钱包后即可查看此页面</p>
        </div>
        <WalletButton />
      </div>
    );
  }

  return <>{children}</>;
}
