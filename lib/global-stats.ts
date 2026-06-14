'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { SIM_VVV_USD_PRICE, type SimClaimRecord, type SimStakeOrder } from '@/contexts/local-web3-sim-context'

export const GLOBAL_STATS_STORAGE_KEY = 'vvveco-global-stats-config'
export const LOCAL_WEB3_SIM_STORAGE_KEY = 'vvveco-local-web3-sim'

export interface GlobalStatsConfig {
  baseStakedUsd: number
  baseClaimedUsd: number
  baseStakers: number
  stakedMinPerEvent: number
  stakedMaxPerEvent: number
  claimedMinPerEvent: number
  claimedMaxPerEvent: number
  stakersMinPerEvent: number
  stakersMaxPerEvent: number
  eventsPerHour: number
  updatedAtMs: number
}

export interface RealGlobalStats {
  realStakedUsd: number
  realClaimedUsd: number
  realStakerCount: number
  realPendingUsd: number
}

export interface ComputedGlobalStats extends RealGlobalStats {
  autoStakedUsd: number
  autoClaimedUsd: number
  autoStakers: number
  displayStakedUsd: number
  displayClaimedUsd: number
  displayStakers: number
}

interface SimStorageState {
  stakes?: SimStakeOrder[]
  claims?: SimClaimRecord[]
}

// Deterministic PRNG: mixes seed + index into [0, 1)
// Same inputs → same output on all clients
function seededRandom(seed: number, index: number): number {
  let h = ((seed & 0x7fffffff) + Math.imul(index, 0x9e3779b9)) | 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function getDefaultGlobalStatsConfig(): GlobalStatsConfig {
  if (typeof window !== 'undefined') {
    fetch('/api/global-stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          localStorage.setItem(GLOBAL_STATS_STORAGE_KEY, JSON.stringify(configFromApi(data.config)))
        }
      })
      .catch(() => {})
  }
  return {
    baseStakedUsd: 100000,
    baseClaimedUsd: 10000,
    baseStakers: 1000,
    stakedMinPerEvent: 100,
    stakedMaxPerEvent: 500,
    claimedMinPerEvent: 10,
    claimedMaxPerEvent: 100,
    stakersMinPerEvent: 1,
    stakersMaxPerEvent: 5,
    eventsPerHour: 10,
    updatedAtMs: Date.now(),
  }
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function configFromApi(raw: Record<string, unknown>): GlobalStatsConfig {
  return {
    baseStakedUsd: Math.max(0, toFiniteNumber(raw.baseStakedUsd)),
    baseClaimedUsd: Math.max(0, toFiniteNumber(raw.baseClaimedUsd)),
    baseStakers: Math.max(0, Math.floor(toFiniteNumber(raw.baseStakers))),
    stakedMinPerEvent: Math.max(0, toFiniteNumber(raw.stakedMinPerEvent, 100)),
    stakedMaxPerEvent: Math.max(0, toFiniteNumber(raw.stakedMaxPerEvent, 500)),
    claimedMinPerEvent: Math.max(0, toFiniteNumber(raw.claimedMinPerEvent, 10)),
    claimedMaxPerEvent: Math.max(0, toFiniteNumber(raw.claimedMaxPerEvent, 100)),
    stakersMinPerEvent: Math.max(0, Math.floor(toFiniteNumber(raw.stakersMinPerEvent, 1))),
    stakersMaxPerEvent: Math.max(0, Math.floor(toFiniteNumber(raw.stakersMaxPerEvent, 5))),
    eventsPerHour: Math.max(1, toFiniteNumber(raw.eventsPerHour, 10)),
    updatedAtMs: raw.updatedAt ? new Date(raw.updatedAt as string).getTime() : Date.now(),
  }
}

function normalizeConfig(config: Partial<GlobalStatsConfig>): GlobalStatsConfig {
  const def = getDefaultGlobalStatsConfig()
  return {
    baseStakedUsd: Math.max(0, toFiniteNumber(config.baseStakedUsd, def.baseStakedUsd)),
    baseClaimedUsd: Math.max(0, toFiniteNumber(config.baseClaimedUsd, def.baseClaimedUsd)),
    baseStakers: Math.max(0, Math.floor(toFiniteNumber(config.baseStakers, def.baseStakers))),
    stakedMinPerEvent: Math.max(0, toFiniteNumber(config.stakedMinPerEvent, def.stakedMinPerEvent)),
    stakedMaxPerEvent: Math.max(0, toFiniteNumber(config.stakedMaxPerEvent, def.stakedMaxPerEvent)),
    claimedMinPerEvent: Math.max(0, toFiniteNumber(config.claimedMinPerEvent, def.claimedMinPerEvent)),
    claimedMaxPerEvent: Math.max(0, toFiniteNumber(config.claimedMaxPerEvent, def.claimedMaxPerEvent)),
    stakersMinPerEvent: Math.max(0, Math.floor(toFiniteNumber(config.stakersMinPerEvent, def.stakersMinPerEvent))),
    stakersMaxPerEvent: Math.max(0, Math.floor(toFiniteNumber(config.stakersMaxPerEvent, def.stakersMaxPerEvent))),
    eventsPerHour: Math.max(1, toFiniteNumber(config.eventsPerHour, def.eventsPerHour)),
    updatedAtMs: toFiniteNumber(config.updatedAtMs, def.updatedAtMs),
  }
}

export function readGlobalStatsConfig(): GlobalStatsConfig {
  if (typeof window === 'undefined') return getDefaultGlobalStatsConfig()
  try {
    const stored = window.localStorage.getItem(GLOBAL_STATS_STORAGE_KEY)
    return stored ? normalizeConfig(JSON.parse(stored)) : getDefaultGlobalStatsConfig()
  } catch {
    return getDefaultGlobalStatsConfig()
  }
}

export function saveGlobalStatsConfig(config: GlobalStatsConfig) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(GLOBAL_STATS_STORAGE_KEY, JSON.stringify(normalizeConfig(config)))
  window.dispatchEvent(new CustomEvent('vvveco-global-stats-change'))
}

export function resetGlobalStatsConfig() {
  const next = getDefaultGlobalStatsConfig()
  saveGlobalStatsConfig(next)
  return next
}

export function readRealGlobalStats(): RealGlobalStats {
  if (typeof window === 'undefined') {
    return { realStakedUsd: 0, realClaimedUsd: 0, realStakerCount: 0, realPendingUsd: 0 }
  }
  try {
    const stored = window.localStorage.getItem(LOCAL_WEB3_SIM_STORAGE_KEY)
    const parsed = stored ? (JSON.parse(stored) as SimStorageState) : {}
    const stakes = Array.isArray(parsed.stakes) ? parsed.stakes : []
    const claims = Array.isArray(parsed.claims) ? parsed.claims : []
    const stakeById = new Map(stakes.map(order => [order.id, order]))
    const stakers = new Set(stakes.map(order => order.account?.toLowerCase()).filter(Boolean))

    const realStakedUsd = stakes.reduce((total, order) => total + Math.max(0, toFiniteNumber(order.usdValue)), 0)
    const realClaimedUsd = claims.reduce((total, claim) => {
      const order = stakeById.get(claim.orderId)
      const amount = Math.max(0, toFiniteNumber(claim.amount))
      if (typeof claim.amountUsd === 'number') return total + Math.max(0, toFiniteNumber(claim.amountUsd))
      if (order?.mode === 'coin') return total + amount * (claim.priceUsd ?? SIM_VVV_USD_PRICE)
      return total + amount
    }, 0)

    return { realStakedUsd, realClaimedUsd, realStakerCount: stakers.size, realPendingUsd: 0 }
  } catch {
    return { realStakedUsd: 0, realClaimedUsd: 0, realStakerCount: 0, realPendingUsd: 0 }
  }
}

const emptyRealGlobalStats: RealGlobalStats = {
  realStakedUsd: 0,
  realClaimedUsd: 0,
  realStakerCount: 0,
  realPendingUsd: 0,
}

export function computeGlobalStats(
  config: GlobalStatsConfig,
  nowMs = Date.now(),
  real: RealGlobalStats = readRealGlobalStats(),
): ComputedGlobalStats {
  const elapsedMs = Math.max(0, nowMs - config.updatedAtMs)
  const eventsPerHour = Math.max(1, config.eventsPerHour)
  const slotMs = 3_600_000 / eventsPerHour
  const maxSlotIndex = Math.min(Math.floor(elapsedMs / slotMs), 100_000)
  const seed = config.updatedAtMs & 0x7fffffff

  let autoStakedUsd = 0
  let autoClaimedUsd = 0
  let autoStakers = 0

  for (let i = 0; i <= maxSlotIndex; i++) {
    // Random fire time within slot i
    const r0 = seededRandom(seed, i * 4)
    const eventMs = i * slotMs + r0 * slotMs
    if (eventMs > elapsedMs) continue

    const r1 = seededRandom(seed, i * 4 + 1)
    const r2 = seededRandom(seed, i * 4 + 2)
    const r3 = seededRandom(seed, i * 4 + 3)

    autoStakedUsd += config.stakedMinPerEvent + r1 * (config.stakedMaxPerEvent - config.stakedMinPerEvent)
    autoClaimedUsd += config.claimedMinPerEvent + r2 * (config.claimedMaxPerEvent - config.claimedMinPerEvent)
    autoStakers += Math.round(config.stakersMinPerEvent + r3 * (config.stakersMaxPerEvent - config.stakersMinPerEvent))
  }

  return {
    ...real,
    autoStakedUsd,
    autoClaimedUsd,
    autoStakers,
    displayStakedUsd: config.baseStakedUsd + autoStakedUsd + real.realStakedUsd,
    displayClaimedUsd: config.baseClaimedUsd + autoClaimedUsd + real.realClaimedUsd,
    displayStakers: config.baseStakers + autoStakers + real.realStakerCount,
  }
}

export function useGlobalStats() {
  const [config, setConfig] = useState<GlobalStatsConfig>(() => getDefaultGlobalStatsConfig())
  const [realStats, setRealStats] = useState<RealGlobalStats>(emptyRealGlobalStats)
  const [now, setNow] = useState(Date.now())

  const sync = useCallback(() => {
    setConfig(readGlobalStatsConfig())
    setRealStats(readRealGlobalStats())
    setNow(Date.now())
  }, [])

  useEffect(() => {
    fetch('/api/global-stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          const next = normalizeConfig(configFromApi(data.config))
          saveGlobalStatsConfig(next)
          setConfig(next)
        }
        if (data.real) {
          setRealStats({
            realStakedUsd: data.real.stakedUsd ?? 0,
            realClaimedUsd: data.real.claimedUsd ?? 0,
            realStakerCount: data.real.stakerCount ?? 0,
            realPendingUsd: data.real.pendingUsd ?? 0,
          })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    sync()
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    window.addEventListener('storage', sync)
    window.addEventListener('vvveco-global-stats-change', sync)
    window.addEventListener('vvveco-local-web3-sim-change', sync)
    window.addEventListener('vvveco-dev-data-reset', sync)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('storage', sync)
      window.removeEventListener('vvveco-global-stats-change', sync)
      window.removeEventListener('vvveco-local-web3-sim-change', sync)
      window.removeEventListener('vvveco-dev-data-reset', sync)
    }
  }, [sync])

  const computed = useMemo(() => computeGlobalStats(config, now, realStats), [config, now, realStats])

  const updateConfig = useCallback((next: Omit<GlobalStatsConfig, 'updatedAtMs'>) => {
    const normalized = normalizeConfig({ ...next, updatedAtMs: Date.now() })
    saveGlobalStatsConfig(normalized)
    setConfig(normalized)
    setNow(Date.now())
  }, [])

  const resetConfig = useCallback(() => {
    const next = resetGlobalStatsConfig()
    setConfig(next)
    setNow(Date.now())
  }, [])

  return { config, computed, updateConfig, resetConfig }
}

export function formatUsdCompact(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return formatUsdFull(value)
}

export function formatUsdFull(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}
