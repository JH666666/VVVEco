"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { WalletButton } from "@/components/layout/wallet-button";
import { Wallet } from "lucide-react";

interface WalletGuardProps {
  children: React.ReactNode;
}

export function WalletGuard({ children }: WalletGuardProps) {
  const [mounted, setMounted] = useState(false);
  const { isConnected } = useAccount();

  useEffect(() => setMounted(true), []);

  // SSR and initial client render: show neutral skeleton to avoid hydration mismatch.
  // useAccount returns isConnected=false on both server and client (wagmi ssr:true),
  // but we still guard here so a server-rendered "please connect" never flickers for
  // users whose wallet reconnects in useEffect.
  if (!mounted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

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
