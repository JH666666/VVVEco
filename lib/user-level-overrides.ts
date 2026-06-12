'use client'

import { useCallback, useEffect, useState } from 'react'

export const USER_LEVEL_OVERRIDES_STORAGE_KEY = 'vvveco-user-level-overrides'

export type UserLevelOverrides = Record<string, number>

export function readUserLevelOverrides(): UserLevelOverrides {
  if (typeof window === 'undefined') return {}

  try {
    const parsed = JSON.parse(window.localStorage.getItem(USER_LEVEL_OVERRIDES_STORAGE_KEY) ?? '{}') as UserLevelOverrides
    return Object.entries(parsed).reduce<UserLevelOverrides>((next, [address, level]) => {
      const safeLevel = Number(level)
      if (Number.isInteger(safeLevel) && safeLevel >= 1 && safeLevel <= 8) {
        next[address.toLowerCase()] = safeLevel
      }
      return next
    }, {})
  } catch {
    return {}
  }
}

export function getUserLevelOverride(address: string, overrides = readUserLevelOverrides()) {
  return overrides[address.toLowerCase()] ?? null
}

export function saveUserLevelOverride(address: string, level: number | null) {
  if (typeof window === 'undefined') return

  const overrides = readUserLevelOverrides()
  const key = address.toLowerCase()

  if (level === null) {
    delete overrides[key]
  } else {
    overrides[key] = Math.min(8, Math.max(1, Math.floor(level)))
  }

  window.localStorage.setItem(USER_LEVEL_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides))
  window.dispatchEvent(new CustomEvent('vvveco-user-level-overrides-change'))
}

export function useUserLevelOverrides() {
  const [overrides, setOverrides] = useState<UserLevelOverrides>(() => ({}))

  const sync = useCallback(() => {
    setOverrides(readUserLevelOverrides())
  }, [])

  useEffect(() => {
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('vvveco-user-level-overrides-change', sync)
    window.addEventListener('vvveco-dev-data-reset', sync)

    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('vvveco-user-level-overrides-change', sync)
      window.removeEventListener('vvveco-dev-data-reset', sync)
    }
  }, [sync])

  return { overrides, setLevelOverride: saveUserLevelOverride }
}
