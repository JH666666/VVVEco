"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";

const STORAGE_KEY = "vvveco-signed-address";

interface WalletAuthState {
  isSigned: boolean;
  signedAddress: `0x${string}` | null;
  setSignedAddress: (addr: `0x${string}`) => void;
  clearAuth: () => void;
}

const WalletAuthContext = createContext<WalletAuthState>({
  isSigned: false,
  signedAddress: null,
  setSignedAddress: () => {},
  clearAuth: () => {},
});

export function WalletAuthProvider({ children }: { children: ReactNode }) {
  const [signedAddress, setSignedAddressState] = useState<`0x${string}` | null>(null);
  const { address: wagmiAddress, isConnected } = useAccount();

  // 从 localStorage 恢复签名地址（页面刷新后保持登录状态）
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSignedAddressState(stored as `0x${string}`);
  }, []);

  // wagmi 重连/切换账户时同步签名态
  useEffect(() => {
    if (!isConnected || !wagmiAddress) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.toLowerCase() === wagmiAddress.toLowerCase()) {
      // 同一地址 — 恢复签名态
      setSignedAddressState(wagmiAddress as `0x${string}`);
    } else {
      // 不同地址 — 清除旧签名，要求重新签名
      setSignedAddressState(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isConnected, wagmiAddress]);

  const setSignedAddress = useCallback((addr: `0x${string}`) => {
    setSignedAddressState(addr);
    localStorage.setItem(STORAGE_KEY, addr);
  }, []);

  const clearAuth = useCallback(() => {
    setSignedAddressState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <WalletAuthContext.Provider value={{ isSigned: !!signedAddress, signedAddress, setSignedAddress, clearAuth }}>
      {children}
    </WalletAuthContext.Provider>
  );
}

export function useWalletAuth() {
  return useContext(WalletAuthContext);
}
