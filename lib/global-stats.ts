'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { SIM_VVV_USD_PRICE, type SimClaimRecord, type SimStakeOrder } from '@/contexts/local-web3-sim-context'

export const GLOBAL_STATS_STORAGE_KEY = 'vvveco-global-stats-config'
export const LOCAL_WEB3_SIM_STORAGE_KEY = 'vvveco-local-web3-sim'

export interface GlobalStatsConfig {
  baseStakedUsd: number
  baseClaimedUsd: number
  baseStakers: number
  stakedGrowthUsdPerHour: number
  claimedGrowthUsdPerHour: number
  stakersGrowthPerDay: number
  updatedAtMs: number
}

export interface RealGlobalStats {
  realStakedUsd: number
  realClaimedUsd: number
  realStakerCount: number
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

export function getDefaultGlobalStatsConfig(): GlobalStatsConfig {
  // Fetch from API, fallback to hardcoded defaults
  if (typeof window !== "undefined") {
    fetch("/api/global-stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          localStorage.setItem(GLOBAL_STATS_STORAGE_KEY, JSON.stringify({
            baseStakedUsd: data.config.baseStakedUsd,
            baseClaimedUsd: data.config.baseClaimedUsd,
            baseStakers: data.config.baseStakers,
            stakedGrowthUsdPerHour: data.config.stakedGrowthUsdPerHour,
            claimedGrowthUsdPerHour: data.config.claimedGrowthUsdPerHour,
            stakersGrowthPerDay: data.config.stakersGrowthPerDay,
            updatedAtMs: new Date(data.config.updatedAt).getTime(),
          }));
        }
      })
      .catch(() => {});
  }
  return {
    baseStakedUsd: 12450000,
    baseClaimedUsd: 2890000,
    baseStakers: 8542,
    stakedGrowthUsdPerHour: 1200,
    claimedGrowthUsdPerHour: 260,
    stakersGrowthPerDay: 18,
    updatedAtMs: Date.now(),
  }
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function normalizeConfig(config: Partial<GlobalStatsConfig>): GlobalStatsConfig {
  const fallback = getDefaultGlobalStatsConfig()

  return {
    baseStakedUsd: Math.max(0, toFiniteNumber(config.baseStakedUsd, fallback.baseStakedUsd)),
    baseClaimedUsd: Math.max(0, toFiniteNumber(config.baseClaimedUsd, fallback.baseClaimedUsd)),
    baseStakers: Math.max(0, Math.floor(toFiniteNumber(config.baseStakers, fallback.baseStakers))),
    stakedGrowthUsdPerHour: Math.max(0, toFiniteNumber(config.stakedGrowthUsdPerHour, fallback.stakedGrowthUsdPerHour)),
    claimedGrowthUsdPerHour: Math.max(0, toFiniteNumber(config.claimedGrowthUsdPerHour, fallback.claimedGrowthUsdPerHour)),
    stakersGrowthPerDay: Math.max(0, toFiniteNumber(config.stakersGrowthPerDay, fallback.stakersGrowthPerDay)),
    updatedAtMs: toFiniteNumber(config.updatedAtMs, fallback.updatedAtMs),
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
    return { realStakedUsd: 0, realClaimedUsd: 0, realStakerCount: 0 }
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

      if (typeof claim.amountUsd === 'number') {
        return total + Math.max(0, toFiniteNumber(claim.amountUsd))
      }

      if (order?.mode === 'coin') {
        return total + amount * (claim.priceUsd ?? SIM_VVV_USD_PRICE)
      }

      return total + amount
    }, 0)

    return {
      realStakedUsd,
      realClaimedUsd,
      realStakerCount: stakers.size,
    }
  } catch {
    return { realStakedUsd: 0, realClaimedUsd: 0, realStakerCount: 0 }
  }
}

const emptyRealGlobalStats: RealGlobalStats = {
  realStakedUsd: 0,
  realClaimedUsd: 0,
  realStakerCount: 0,
}

export function computeGlobalStats(
  config: GlobalStatsConfig,
  nowMs = Date.now(),
  real: RealGlobalStats = readRealGlobalStats(),
): ComputedGlobalStats {
  const elapsedHours = Math.max(0, (nowMs - config.updatedAtMs) / 3_600_000)
  const elapsedDays = elapsedHours / 24
  const autoStakedUsd = config.stakedGrowthUsdPerHour * elapsedHours
  const autoClaimedUsd = config.claimedGrowthUsdPerHour * elapsedHours
  const autoStakers = Math.floor(config.stakersGrowthPerDay * elapsedDays)

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

  // Fetch config from API on mount and update state + localStorage
  useEffect(() => {
    fetch("/api/global-stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          const next = normalizeConfig({
            baseStakedUsd: data.config.baseStakedUsd,
            baseClaimedUsd: data.config.baseClaimedUsd,
            baseStakers: data.config.baseStakers,
            stakedGrowthUsdPerHour: data.config.stakedGrowthUsdPerHour,
            claimedGrowthUsdPerHour: data.config.claimedGrowthUsdPerHour,
            stakersGrowthPerDay: data.config.stakersGrowthPerDay,
            updatedAtMs: new Date(data.config.updatedAt).getTime(),
          })
          saveGlobalStatsConfig(next)
          setConfig(next)
        }
        // Real on-chain stats come from API response
        if (data.real) {
          setRealStats({
            realStakedUsd: data.real.stakedUsd ?? 0,
            realClaimedUsd: data.real.claimedUsd ?? 0,
            realStakerCount: data.real.stakerCount ?? 0,
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
