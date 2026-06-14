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
  uidMap: Record<string, number>;
}

const defaultState: AdminControlsState = {
  hiddenOrderIds: [],
  controlledAddresses: [],
  frozenPersonalClaims: [],
  frozenTeamClaims: [],
  frozenPrincipalWithdrawals: [],
  freezeAudits: {},
  uidMap: {},
};

// Local cache for fast UI checks, synced from API
let _cached: AdminControlsState = { ...defaultState };

export function readAdminControls(): AdminControlsState {
  return _cached;
}

// ═══════════ API-based operations ═══════════
export interface FreezeListItem {
  walletAddress: string;
  uid: number | null;
  personalClaimFrozen: boolean;
  teamClaimFrozen: boolean;
  principalWithdrawFrozen: boolean;
  frozenAt?: number;
  unfrozenAt?: number;
}

async function fetchFreezeList(): Promise<{ frozenPersonalClaims: string[]; frozenTeamClaims: string[]; frozenPrincipalWithdrawals: string[]; freezeAudits: AdminControlsState["freezeAudits"]; uidMap: Record<string, number> }> {
  try {
    const res = await fetch("/api/admin/freeze-list");
    if (!res.ok) throw new Error("API fail");
    const data = await res.json();
    const items: Array<Record<string, unknown>> = data.items ?? [];
    const freezeAudits: AdminControlsState["freezeAudits"] = {};
    const uidMap: Record<string, number> = {};
    for (const i of items) {
      const addr = (i.walletAddress as string).toLowerCase();
      const frozenAt = i.frozenAt ? new Date(i.frozenAt as string).getTime() : undefined;
      const unfrozenAt = i.unfrozenAt ? new Date(i.unfrozenAt as string).getTime() : undefined;
      freezeAudits[addr] = {
        personal: { frozenAt, unfrozenAt },
        principal: { frozenAt, unfrozenAt },
      };
      if (i.uid != null) uidMap[addr] = i.uid as number;
    }
    return {
      frozenPersonalClaims: items.filter(i => i.personalClaimFrozen).map(i => i.walletAddress as string),
      frozenTeamClaims: items.filter(i => i.teamClaimFrozen).map(i => i.walletAddress as string),
      frozenPrincipalWithdrawals: items.filter(i => i.principalWithdrawFrozen).map(i => i.walletAddress as string),
      freezeAudits,
      uidMap,
    };
  } catch {
    const raw = localStorage.getItem("vvveco-admin-controls");
    if (!raw) return { frozenPersonalClaims: [], frozenTeamClaims: [], frozenPrincipalWithdrawals: [], freezeAudits: {}, uidMap: {} };
    const parsed = JSON.parse(raw);
    return {
      frozenPersonalClaims: parsed.frozenPersonalClaims ?? [],
      frozenTeamClaims: parsed.frozenTeamClaims ?? [],
      frozenPrincipalWithdrawals: parsed.frozenPrincipalWithdrawals ?? [],
      freezeAudits: {},
      uidMap: {},
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
        freezeAudits: list.freezeAudits,
        uidMap: list.uidMap,
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
