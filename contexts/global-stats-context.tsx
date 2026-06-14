'use client'

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import {
  type ComputedGlobalStats,
  type GlobalStatsConfig,
  type RealGlobalStats,
  computeGlobalStats,
  readGlobalStatsConfig,
  readRealGlobalStats,
  saveGlobalStatsConfig,
  resetGlobalStatsConfig,
} from '@/lib/global-stats'

function toFiniteNumber(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
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

interface GlobalStatsContextValue {
  config: GlobalStatsConfig
  computed: ComputedGlobalStats
  isLoading: boolean
  updateConfig: (next: Omit<GlobalStatsConfig, 'updatedAtMs'>) => void
  resetConfig: () => void
}

const GlobalStatsContext = createContext<GlobalStatsContextValue | null>(null)

const emptyReal: RealGlobalStats = {
  realStakedUsd: 0,
  realClaimedUsd: 0,
  realStakerCount: 0,
  realPendingUsd: 0,
}

export function GlobalStatsProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<GlobalStatsConfig>(readGlobalStatsConfig)
  const [realStats, setRealStats] = useState<RealGlobalStats>(emptyReal)
  const [now, setNow] = useState(Date.now)
  const [isLoading, setIsLoading] = useState(true)

  const sync = useCallback(() => {
    setConfig(readGlobalStatsConfig())
    setRealStats(readRealGlobalStats())
    setNow(Date.now())
  }, [])

  // Single fetch: load DB config + real stats, then compute display client-side.
  // isLoading stays true until this resolves so UI never shows stale defaults.
  useEffect(() => {
    fetch('/api/global-stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          const next = configFromApi(data.config)
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
      .finally(() => setIsLoading(false))
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

  // displayStakedUsd = base + randomEvents + realStakedUsd (from DB)
  // displayClaimedUsd = base + randomEvents + realClaimedUsd (from DB)
  // displayStakers = base + randomEvents + realStakerCount (from DB)
  const computed = useMemo(() => computeGlobalStats(config, now, realStats), [config, now, realStats])

  const updateConfig = useCallback((next: Omit<GlobalStatsConfig, 'updatedAtMs'>) => {
    const updated = { ...next, updatedAtMs: Date.now() }
    saveGlobalStatsConfig(updated)
    setConfig(updated)
    setNow(Date.now())
  }, [])

  const resetConfig = useCallback(() => {
    const next = resetGlobalStatsConfig()
    setConfig(next)
    setNow(Date.now())
  }, [])

  return (
    <GlobalStatsContext.Provider value={{ config, computed, isLoading, updateConfig, resetConfig }}>
      {children}
    </GlobalStatsContext.Provider>
  )
}

export function useGlobalStatsContext(): GlobalStatsContextValue {
  const ctx = useContext(GlobalStatsContext)
  if (!ctx) throw new Error('useGlobalStatsContext must be used within GlobalStatsProvider')
  return ctx
}
