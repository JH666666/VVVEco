"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

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

  const setSignedAddress = useCallback((addr: `0x${string}`) => {
    setSignedAddressState(addr);
  }, []);

  const clearAuth = useCallback(() => {
    setSignedAddressState(null);
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
