"use client";

import { useCallback, useEffect, useState } from "react";

export type FreezePermissionType = "personal" | "team" | "principal";

export interface FreezeAuditEntry {
  frozenAt?: number;
  unfrozenAt?: number;
}

export interface AdminControlsState {
  hiddenOrderIds: string[];
  controlledAddresses: string[];
  frozenPersonalClaims: string[];
  frozenTeamClaims: string[];
  frozenPrincipalWithdrawals: string[];
  freezeAudits: Record<string, Partial<Record<FreezePermissionType, FreezeAuditEntry>>>;
}

const defaultState: AdminControlsState = {
  hiddenOrderIds: [],
  controlledAddresses: [],
  frozenPersonalClaims: [],
  frozenTeamClaims: [],
  frozenPrincipalWithdrawals: [],
  freezeAudits: {},
};

// Local cache for fast UI checks, synced from API
let _cached: AdminControlsState = { ...defaultState };

export function readAdminControls(): AdminControlsState {
  return _cached;
}

// ═══════════ API-based operations ═══════════
async function fetchFreezeList(): Promise<{ frozenPersonalClaims: string[]; frozenTeamClaims: string[]; frozenPrincipalWithdrawals: string[] }> {
  try {
    const res = await fetch("/api/admin/freeze");
    if (!res.ok) throw new Error("API fail");
    const data = await res.json();
    return {
      frozenPersonalClaims: (data.items ?? []).filter((i: Record<string, boolean>) => i.personalClaimFrozen).map((i: Record<string, string>) => i.walletAddress),
      frozenTeamClaims: (data.items ?? []).filter((i: Record<string, boolean>) => i.teamClaimFrozen).map((i: Record<string, string>) => i.walletAddress),
      frozenPrincipalWithdrawals: (data.items ?? []).filter((i: Record<string, boolean>) => i.principalWithdrawFrozen).map((i: Record<string, string>) => i.walletAddress),
    };
  } catch {
    const raw = localStorage.getItem("vvveco-admin-controls");
    if (!raw) return { frozenPersonalClaims: [], frozenTeamClaims: [], frozenPrincipalWithdrawals: [] };
    const parsed = JSON.parse(raw);
    return {
      frozenPersonalClaims: parsed.frozenPersonalClaims ?? [],
      frozenTeamClaims: parsed.frozenTeamClaims ?? [],
      frozenPrincipalWithdrawals: parsed.frozenPrincipalWithdrawals ?? [],
    };
  }
}

export async function setPersonalClaimFrozen(address: string, frozen: boolean, adminAddr = "admin") {
  await fetch("/api/admin/freeze", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetAddress: address, personalClaim: frozen, adminAddress: adminAddr }),
  });
  _cached = { ..._cached };
  if (frozen) _cached.frozenPersonalClaims.push(address.toLowerCase());
  else _cached.frozenPersonalClaims = _cached.frozenPersonalClaims.filter((a) => a !== address.toLowerCase());
}

export async function setTeamClaimFrozen(address: string, frozen: boolean, adminAddr = "admin") {
  await fetch("/api/admin/freeze", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetAddress: address, teamClaim: frozen, adminAddress: adminAddr }),
  });
  _cached = { ..._cached };
  if (frozen) _cached.frozenTeamClaims.push(address.toLowerCase());
  else _cached.frozenTeamClaims = _cached.frozenTeamClaims.filter((a) => a !== address.toLowerCase());
}

export async function setPrincipalWithdrawalFrozen(address: string, frozen: boolean, adminAddr = "admin") {
  await fetch("/api/admin/freeze", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetAddress: address, principalWithdraw: frozen, adminAddress: adminAddr }),
  });
  _cached = { ..._cached };
  if (frozen) _cached.frozenPrincipalWithdrawals.push(address.toLowerCase());
  else _cached.frozenPrincipalWithdrawals = _cached.frozenPrincipalWithdrawals.filter((a) => a !== address.toLowerCase());
}

export async function setOrderHidden(txHash: string, hidden: boolean, adminAddr = "admin") {
  await fetch("/api/admin/hide-order", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash, hidden, adminAddress: adminAddr }),
  });
  _cached = { ..._cached };
  if (hidden) _cached.hiddenOrderIds.push(txHash);
  else _cached.hiddenOrderIds = _cached.hiddenOrderIds.filter((id) => id !== txHash);
}

export function isPersonalClaimFrozen(address: string) {
  return _cached.frozenPersonalClaims.includes(address?.toLowerCase() ?? "");
}
export function isTeamClaimFrozen(address: string) {
  return _cached.frozenTeamClaims.includes(address?.toLowerCase() ?? "");
}
export function isPrincipalWithdrawalFrozen(address: string) {
  return _cached.frozenPrincipalWithdrawals.includes(address?.toLowerCase() ?? "");
}

export function useAdminControls() {
  const [controls, setControls] = useState<AdminControlsState>(defaultState);

  useEffect(() => {
    fetchFreezeList().then((list) => {
      const state: AdminControlsState = {
        ...defaultState,
        ...list,
        controlledAddresses: [...new Set([...list.frozenPersonalClaims, ...list.frozenTeamClaims, ...list.frozenPrincipalWithdrawals])],
      };
      _cached = state;
      setControls(state);
    });
  }, []);

  const hideOrder = useCallback(async (orderId: string, hidden: boolean) => {
    await setOrderHidden(orderId, hidden);
    setControls({ ..._cached });
  }, []);

  const freezePersonalClaim = useCallback(async (address: string, frozen: boolean) => {
    await setPersonalClaimFrozen(address, frozen);
    setControls({ ..._cached });
  }, []);

  const freezeTeamClaim = useCallback(async (address: string, frozen: boolean) => {
    await setTeamClaimFrozen(address, frozen);
    setControls({ ..._cached });
  }, []);

  const freezePrincipalWithdrawal = useCallback(async (address: string, frozen: boolean) => {
    await setPrincipalWithdrawalFrozen(address, frozen);
    setControls({ ..._cached });
  }, []);

  return { controls, hideOrder, freezePersonalClaim, freezeTeamClaim, freezePrincipalWithdrawal };
}
