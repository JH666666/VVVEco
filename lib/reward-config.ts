'use client'

import { useCallback, useEffect, useState } from 'react'

export const REWARD_CONFIG_STORAGE_KEY = 'vvveco-reward-config'
export type PeriodUnit = 'day' | 'hour'

export interface RewardConfig {
  generationRates: [number, number, number]
  levelRates: [number, number, number, number, number, number, number, number]
  levelThresholds: [number, number, number, number, number, number, number, number]
  periodRates: [number, number, number, number]
  periodDurations: [number, number, number, number]
  periodUnits: [PeriodUnit, PeriodUnit, PeriodUnit, PeriodUnit]
}

export function getDefaultRewardConfig(): RewardConfig {
  return {
    generationRates: [10, 5, 3],
    levelRates: [3, 4, 5, 6, 7, 8, 9, 10],
    levelThresholds: [0, 10000, 20000, 30000, 50000, 100000, 150000, 200000],
    periodRates: [0.7, 0.8, 0.9, 1],
    periodDurations: [1, 15, 30, 60],
    periodUnits: ['day', 'day', 'day', 'day'],
  }
}

function toPercent(value: unknown, fallback: number) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.min(100, Math.max(0, next))
}

function toDuration(value: unknown, fallback: number) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.max(1, next)
}

function toThreshold(value: unknown, fallback: number) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.max(0, next)
}

function toPeriodUnit(value: unknown, fallback: PeriodUnit): PeriodUnit {
  return value === 'day' ? value : fallback
}

function normalizeRewardConfig(config: Partial<RewardConfig>): RewardConfig {
  const fallback = getDefaultRewardConfig()
  const generationRates = Array.isArray(config.generationRates) ? config.generationRates : fallback.generationRates
  const levelRates = Array.isArray(config.levelRates) ? config.levelRates : fallback.levelRates
  const levelThresholds = Array.isArray(config.levelThresholds) ? config.levelThresholds : fallback.levelThresholds
  const periodRates = Array.isArray(config.periodRates) ? config.periodRates : fallback.periodRates
  const periodDurations = Array.isArray(config.periodDurations) ? config.periodDurations : fallback.periodDurations
  const periodUnits = Array.isArray(config.periodUnits) ? config.periodUnits : fallback.periodUnits

  return {
    generationRates: [
      toPercent(generationRates[0], fallback.generationRates[0]),
      toPercent(generationRates[1], fallback.generationRates[1]),
      toPercent(generationRates[2], fallback.generationRates[2]),
    ],
    levelRates: [
      toPercent(levelRates[0], fallback.levelRates[0]),
      toPercent(levelRates[1], fallback.levelRates[1]),
      toPercent(levelRates[2], fallback.levelRates[2]),
      toPercent(levelRates[3], fallback.levelRates[3]),
      toPercent(levelRates[4], fallback.levelRates[4]),
      toPercent(levelRates[5], fallback.levelRates[5]),
      toPercent(levelRates[6], fallback.levelRates[6]),
      toPercent(levelRates[7], fallback.levelRates[7]),
    ],
    levelThresholds: [
      toThreshold(levelThresholds[0], fallback.levelThresholds[0]),
      toThreshold(levelThresholds[1], fallback.levelThresholds[1]),
      toThreshold(levelThresholds[2], fallback.levelThresholds[2]),
      toThreshold(levelThresholds[3], fallback.levelThresholds[3]),
      toThreshold(levelThresholds[4], fallback.levelThresholds[4]),
      toThreshold(levelThresholds[5], fallback.levelThresholds[5]),
      toThreshold(levelThresholds[6], fallback.levelThresholds[6]),
      toThreshold(levelThresholds[7], fallback.levelThresholds[7]),
    ],
    periodRates: [
      toPercent(periodRates[0], fallback.periodRates[0]),
      toPercent(periodRates[1], fallback.periodRates[1]),
      toPercent(periodRates[2], fallback.periodRates[2]),
      toPercent(periodRates[3], fallback.periodRates[3]),
    ],
    periodDurations: [
      toDuration(periodDurations[0], fallback.periodDurations[0]),
      toDuration(periodDurations[1], fallback.periodDurations[1]),
      toDuration(periodDurations[2], fallback.periodDurations[2]),
      toDuration(periodDurations[3], fallback.periodDurations[3]),
    ],
    periodUnits: [
      toPeriodUnit(periodUnits[0], fallback.periodUnits[0]),
      toPeriodUnit(periodUnits[1], fallback.periodUnits[1]),
      toPeriodUnit(periodUnits[2], fallback.periodUnits[2]),
      toPeriodUnit(periodUnits[3], fallback.periodUnits[3]),
    ],
  }
}

export function readRewardConfig(): RewardConfig {
  return getDefaultRewardConfig()
}

let _cachedConfig: RewardConfig | null = null

async function fetchRewardConfigAPI(): Promise<RewardConfig> {
  const fallback = getDefaultRewardConfig()
  const [rewardRes, levelRes] = await Promise.all([
    fetch("/api/config/reward").then(r => r.json()).catch(() => ({})),
    fetch("/api/config/level-config").then(r => r.json()).catch(() => ({})),
  ])
  return {
    generationRates: (rewardRes.generationRates ?? fallback.generationRates) as [number, number, number],
    levelRates: (levelRes.levelRates?.length === 8 ? levelRes.levelRates : fallback.levelRates) as [number, number, number, number, number, number, number, number],
    levelThresholds: (levelRes.levelThresholds?.length === 8 ? levelRes.levelThresholds : fallback.levelThresholds) as [number, number, number, number, number, number, number, number],
    periodRates: (rewardRes.periodRates ?? fallback.periodRates) as [number, number, number, number],
    periodDurations: (rewardRes.periodDurations ?? fallback.periodDurations) as [number, number, number, number],
    periodUnits: (rewardRes.periodUnits ?? fallback.periodUnits) as ["day", "day", "day", "day"],
  }
}

export function useRewardConfig() {
  const [config, setConfig] = useState<RewardConfig>(() => getDefaultRewardConfig())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchRewardConfigAPI()
      .then(next => { setConfig(next); setIsLoading(false) })
      .catch(() => { setConfig(getDefaultRewardConfig()); setIsLoading(false) })
  }, [])

  const updateRewardConfig = useCallback(async (next: RewardConfig) => {
    setConfig(normalizeRewardConfig(next))
    await fetch("/api/config/reward", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationRates: next.generationRates,
        periodRates: next.periodRates,
        periodDurations: next.periodDurations,
        periodUnits: next.periodUnits,
      }),
    }).catch(() => {})
  }, [])

  const resetRewards = useCallback(async () => {
    const next = getDefaultRewardConfig()
    setConfig(next)
    await fetch("/api/config/reward", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationRates: next.generationRates,
        periodRates: next.periodRates,
        periodDurations: next.periodDurations,
        periodUnits: next.periodUnits,
      }),
    }).catch(() => {})
  }, [])

  return { config, updateRewardConfig, resetRewards, isLoading }
}
