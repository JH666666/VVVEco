'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { readRewardConfig, type PeriodUnit } from '@/lib/reward-config'
import { getUserLevelOverride, readUserLevelOverrides } from '@/lib/user-level-overrides'

export type SimStakeMode = 'coin' | 'fiat'

export interface SimAccount {
  uid: number
  id: string
  label: string
  role: string
  address: string
  shortAddress: string
}

export interface SimStakeOrder {
  id: string
  account: string
  referrer?: string
  mode: SimStakeMode
  amount: number
  usdValue: number
  period: number
  periodUnit?: PeriodUnit
  dailyRate: number
  createdAt: string
  createdAtMs?: number
  endTime?: string
  txHash: string
  isWithdrawn?: boolean
}

export interface SimClaimRecord {
  id: string
  orderId: string
  account: string
  amount: number
  mode?: SimStakeMode
  priceUsd?: number
  amountVvv?: number
  amountUsd?: number
  createdAt: string
  createdAtMs: number
}

export interface SimTeamRewardRecord {
  id: string
  claimId: string
  type?: 'level' | 'peer' | 'generation'
  generation?: number
  beneficiary: string
  sourceAccount: string
  sourceOrderId: string
  sourceClaimAmount: number
  sourceClaimAmountVvv: number
  rate: number
  amount: number
  claimed: boolean
  createdAt: string
  createdAtMs: number
  claimedAt?: string
  claimedAtMs?: number
}

interface SimState {
  currentAddress: string
  generatedAccounts: SimAccount[]
  referrals: Record<string, string>
  stakes: SimStakeOrder[]
  approvals: Record<string, boolean>
  claims: SimClaimRecord[]
  teamRewards: SimTeamRewardRecord[]
}

interface LocalWeb3SimContextValue extends SimState {
  accounts: SimAccount[]
  currentAccount: SimAccount
  isApproved: boolean
  createAccount: () => SimAccount
  switchAccount: (address: string) => void
  approve: () => Promise<string>
  stake: (input: {
    referrer?: string
    mode: SimStakeMode
    amount: number
    usdValue: number
    period: number
    periodUnit?: PeriodUnit
    dailyRate: number
  }) => Promise<string>
  bindReferrer: (address: string, referrer: string) => void
  unbindReferrer: (address: string) => void
  claimReward: (orderId: string, amount: number) => void
  claimTeamRewards: (beneficiary: string) => number
  getDefaultReferrer: (address?: string) => string
}

const STORAGE_KEY = 'vvveco-local-web3-sim'
export const BOUND_REFERRER_KEY = 'vvveco-bound-referrer'
export const SIM_WALLET_INITIAL_VVV_BALANCE = 1_000_000
export const SIM_VVV_USD_PRICE = 0.2
export const SIM_ROOT_WALLET_ADDRESS = '0x7a3F512400000000000000000000000000004e2b'
const UID_COUNTER_KEY = 'vvveco-uid-counter'
export const UID_START = 100001

export function getBoundReferrerStorageKey(address: string) {
  return `${BOUND_REFERRER_KEY}:${address.toLowerCase()}`
}

function createGeneratedAccount(index: number, uid: number): SimAccount {
  const padded = String(index).padStart(3, '0')
  const addressSuffix = String(index).padStart(40, '0')

  return {
    uid,
    id: `account-${index}`,
    label: `Account ${index}`,
    role: index <= 8 ? `Level ${index - 1} Sub-node` : `Matrix Test Wallet ${index}`,
    address: `0xB${padded}${addressSuffix.slice(4)}`,
    shortAddress: formatSimAddress(`0xB${padded}${addressSuffix.slice(4)}`),
  }
}

export const simAccounts: SimAccount[] = [
  {
    uid: 100001,
    id: 'account-1',
    label: 'Account 1',
    role: 'Owner Admin / Deployment Master',
    address: SIM_ROOT_WALLET_ADDRESS,
    shortAddress: formatSimAddress(SIM_ROOT_WALLET_ADDRESS),
  },
  {
    uid: 100002,
    id: 'account-2',
    label: 'Account 2',
    role: 'Top Leader',
    address: '0x0a28A06f000000000000000000000000000002c6',
    shortAddress: formatSimAddress('0x0a28A06f000000000000000000000000000002c6'),
  },
  ...Array.from({ length: 18 }, (_, index) => createGeneratedAccount(index + 3, 100003 + index)),
]

const initialState: SimState = {
  currentAddress: '',
  generatedAccounts: [],
  referrals: {},
  stakes: [],
  approvals: {},
  claims: [],
  teamRewards: [],
}

const LocalWeb3SimContext = createContext<LocalWeb3SimContextValue | undefined>(undefined)

export function getSimAccounts(generatedAccounts: SimAccount[] = []) {
  const known = new Set<string>()

  return [...simAccounts, ...generatedAccounts].filter(account => {
    const key = account.address.toLowerCase()
    if (known.has(key)) return false
    known.add(key)
    return true
  })
}

export function readStoredSimAccounts() {
  if (typeof window === 'undefined') return simAccounts

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) as Partial<SimState> : {}
    return getSimAccounts(Array.isArray(parsed.generatedAccounts) ? parsed.generatedAccounts : [])
  } catch {
    return simAccounts
  }
}

function getCanonicalSimAddress(address: string, accounts = simAccounts) {
  return accounts.find(account => account.address.toLowerCase() === address.toLowerCase())?.address ?? address
}

function readState() {
  if (typeof window === 'undefined') return initialState

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const parsed = stored ? { ...initialState, ...JSON.parse(stored) } as SimState : initialState
    const accounts = getSimAccounts(Array.isArray(parsed.generatedAccounts) ? parsed.generatedAccounts : [])
    const syncedReferrals = { ...parsed.referrals }

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key?.startsWith(`${BOUND_REFERRER_KEY}:`)) continue

      const childAddress = getCanonicalSimAddress(key.replace(`${BOUND_REFERRER_KEY}:`, ''), accounts)
      const referrer = window.localStorage.getItem(key)
      const canonicalReferrer = referrer ? getCanonicalSimAddress(referrer, accounts) : ''

      if (canonicalReferrer && !syncedReferrals[childAddress]) {
        syncedReferrals[childAddress] = canonicalReferrer
      }
    }

    return {
      ...parsed,
      generatedAccounts: accounts.filter(account => !simAccounts.some(base => base.address.toLowerCase() === account.address.toLowerCase())),
      referrals: syncedReferrals,
    }
  } catch {
    return initialState
  }
}

function createRandomAddress(existingAccounts: SimAccount[]) {
  const existing = new Set(existingAccounts.map(account => account.address.toLowerCase()))

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = new Uint8Array(20)
    window.crypto.getRandomValues(bytes)
    const address = `0x${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`

    if (!existing.has(address.toLowerCase())) {
      return address
    }
  }

  return `0x${Date.now().toString(16).padStart(40, '0').slice(-40)}`
}

function createCustomSimAccount(index: number, address: string, uid: number): SimAccount {
  return {
    uid,
    id: `account-${index}`,
    label: `Account ${index}`,
    role: `Generated Test Wallet ${index}`,
    address,
    shortAddress: formatSimAddress(address),
  }
}

function createTxHash() {
  return `0xsim${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`
}

function nextUid(): number {
  if (typeof window === 'undefined') return UID_START + 20

  try {
    const stored = window.localStorage.getItem(UID_COUNTER_KEY)
    const current = stored ? Math.max(UID_START + 20, parseInt(stored, 10) || UID_START + 20) : UID_START + 20
    const next = current + 1

    window.localStorage.setItem(UID_COUNTER_KEY, String(next))
    return next
  } catch {
    return UID_START + 20 + 1
  }
}

function resetUidCounter() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(UID_COUNTER_KEY)
}

function getRawChildren(address: string, referrals: Record<string, string>) {
  return Object.entries(referrals)
    .filter(([, parent]) => parent.toLowerCase() === address.toLowerCase())
    .map(([child]) => child)
}

function isActiveStakeOrder(order: SimStakeOrder, nowMs = Date.now()) {
  const startMs = order.createdAtMs ?? nowMs
  const unitMs = order.periodUnit === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  return nowMs < startMs + order.period * unitMs
}

function getDirectStake(address: string, stakes: SimStakeOrder[]) {
  return stakes
    .filter(order => order.account.toLowerCase() === address.toLowerCase() && isActiveStakeOrder(order))
    .reduce((sum, order) => sum + order.usdValue, 0)
}

function isCompressedActive(address: string, stakes: SimStakeOrder[]) {
  return address.toLowerCase() === SIM_ROOT_WALLET_ADDRESS.toLowerCase() || getDirectStake(address, stakes) > 0
}

function getCompressedChildren(address: string, referrals: Record<string, string>, stakes: SimStakeOrder[]): string[] {
  return getRawChildren(address, referrals).flatMap(child => (
    isCompressedActive(child, stakes) ? [child] : getCompressedChildren(child, referrals, stakes)
  ))
}

function getCompressedTeamStake(address: string, referrals: Record<string, string>, stakes: SimStakeOrder[], remainingLevels = 7): number {
  if (remainingLevels <= 0) return 0

  return getCompressedChildren(address, referrals, stakes).reduce((total, child) => {
    const childStake = getDirectStake(child, stakes)

    return total + childStake + getCompressedTeamStake(child, referrals, stakes, remainingLevels - 1)
  }, 0)
}

function getTeamRewardLevel(
  address: string,
  referrals: Record<string, string>,
  stakes: SimStakeOrder[],
  levelRates: number[],
  levelThresholds: number[],
  levelOverrides: Record<string, number>,
) {
  const manualLevel = getUserLevelOverride(address, levelOverrides)

  if (manualLevel) {
    return {
      level: manualLevel,
      rate: levelRates[manualLevel - 1] ?? manualLevel * 10,
    }
  }

  const teamStake = getCompressedTeamStake(address, referrals, stakes)

  for (let index = levelRates.length - 1; index >= 0; index -= 1) {
    if (teamStake >= (levelThresholds[index] ?? 0)) {
      return {
        level: index + 1,
        rate: levelRates[index] ?? (index + 1) * 10,
      }
    }
  }

  return {
    level: 1,
    rate: levelRates[0] ?? 10,
  }
}

function getCompressedUplineAddresses(address: string, referrals: Record<string, string>, stakes: SimStakeOrder[]) {
  const uplines: string[] = []
  let currentAddress = address

  for (let hop = 0; hop < 40 && uplines.length < 7; hop += 1) {
    const parent = referrals[currentAddress] ?? Object.entries(referrals)
      .find(([child]) => child.toLowerCase() === currentAddress.toLowerCase())?.[1]

    if (!parent) break

    if (isCompressedActive(parent, stakes)) {
      uplines.push(parent)
    }

    currentAddress = parent
  }

  return uplines
}

function waitForReceipt() {
  return new Promise(resolve => window.setTimeout(resolve, 1000))
}

function normalizeInviteCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function formatSimAddress(address: string) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-6)}`
}

function getLegacyInviteCode(address: string) {
  return address.slice(2, 10).toUpperCase()
}

export function getSimInviteCode(address: string) {
  const normalized = address.toLowerCase()
  let hash = 2166136261

  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const alphabet = `${letters}${digits}`
  let code = ''
  let rolling = hash >>> 0

  for (let index = 0; index < 8; index += 1) {
    rolling = Math.imul(rolling ^ (index + 17), 2654435761) >>> 0
    code += alphabet[rolling % alphabet.length]
  }

  if (!/[A-Z]/.test(code)) {
    code = `${letters[rolling % letters.length]}${code.slice(1)}`
  }

  if (!/\d/.test(code)) {
    code = `${code.slice(0, 7)}${digits[rolling % digits.length]}`
  }

  return code
}

export function resolveSimInviteCode(input: string, currentAddress = '') {
  const raw = input.trim()
  const normalized = normalizeInviteCode(raw)

  if (!normalized) return ''

  if (/^0x[a-f0-9]{40}$/i.test(raw) && raw.toLowerCase() !== currentAddress.toLowerCase()) {
    return raw
  }

  const match = readStoredSimAccounts().find(account => {
    const address = account.address.toLowerCase()
    const inviteCode = getSimInviteCode(account.address).toLowerCase()
    const legacyInviteCode = getLegacyInviteCode(account.address).toLowerCase()
    const shortAddress = account.shortAddress.toLowerCase()
    const normalizedShort = normalizeInviteCode(account.shortAddress)
    const normalizedLabel = normalizeInviteCode(account.label)
    const normalizedId = normalizeInviteCode(account.id)

    return raw.toLowerCase() === address
      || raw.toLowerCase() === shortAddress
      || normalized === normalizeInviteCode(address)
      || normalized === normalizedShort
      || normalized === inviteCode
      || normalized === legacyInviteCode
      || normalized === normalizedLabel
      || normalized === normalizedId
  })

  if (!match || match.address.toLowerCase() === currentAddress.toLowerCase()) {
    return ''
  }

  return match.address
}

export function LocalWeb3SimProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SimState>(initialState)

  useEffect(() => {
    const sync = () => setState(readState())
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('vvveco-local-web3-sim-change', sync)
    window.addEventListener('vvveco-dev-data-reset', sync)

    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('vvveco-local-web3-sim-change', sync)
      window.removeEventListener('vvveco-dev-data-reset', sync)
    }
  }, [])

  const updateState = (updater: (current: SimState) => SimState) => {
    const next = updater(readState())
    setState(next)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('vvveco-local-web3-sim-change'))
  }

  const getDefaultReferrer = () => ''

  const value = useMemo<LocalWeb3SimContextValue>(() => {
    const accounts = getSimAccounts(state.generatedAccounts)
    const currentAccount = accounts.find(account => account.address === state.currentAddress) ?? {
      uid: 0,
      id: 'disconnected',
      label: '未连接',
      role: 'No mock wallet selected',
      address: '',
      shortAddress: '未连接',
    }
    const isApproved = Boolean(state.approvals[currentAccount.address])

    return {
      ...state,
      accounts,
      currentAccount,
      isApproved,
      getDefaultReferrer,
      createAccount: () => {
        const current = readState()
        const currentAccounts = getSimAccounts(current.generatedAccounts)
        const address = createRandomAddress(currentAccounts)
        const account = createCustomSimAccount(currentAccounts.length + 1, address, nextUid())
        const next = {
          ...current,
          currentAddress: address,
          generatedAccounts: [...current.generatedAccounts, account],
        }

        setState(next)
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        window.dispatchEvent(new CustomEvent('vvveco-local-web3-sim-change'))

        return account
      },
      switchAccount: (address: string) => {
        updateState(current => ({ ...current, currentAddress: address }))
      },
      approve: async () => {
        await waitForReceipt()
        const txHash = createTxHash()
        updateState(current => ({
          ...current,
          approvals: { ...current.approvals, [current.currentAddress]: true },
        }))
        return txHash
      },
      stake: async input => {
        await waitForReceipt()
        const txHash = createTxHash()
        const currentAddress = readState().currentAddress
        const createdAtMs = Date.now()
        const storedReferrer = currentAddress
          ? window.localStorage.getItem(getBoundReferrerStorageKey(currentAddress)) ?? ''
          : ''
        const requestedReferrer = input.referrer || storedReferrer
        const fallbackReferrer = currentAddress && currentAddress.toLowerCase() !== SIM_ROOT_WALLET_ADDRESS.toLowerCase()
          ? SIM_ROOT_WALLET_ADDRESS
          : ''
        const referrer = requestedReferrer && requestedReferrer !== currentAddress
          ? requestedReferrer
          : fallbackReferrer
        if (referrer) {
          window.localStorage.setItem(getBoundReferrerStorageKey(currentAddress), referrer)
        }
        updateState(current => ({
          ...current,
          referrals: referrer && !current.referrals[currentAddress]
            ? { ...current.referrals, [currentAddress]: referrer }
            : current.referrals,
          stakes: [
            {
              id: txHash,
              account: currentAddress,
              referrer: referrer || undefined,
              mode: input.mode,
              amount: input.amount,
              usdValue: input.usdValue,
              period: input.period,
              periodUnit: input.periodUnit ?? 'day',
              dailyRate: input.dailyRate,
              createdAt: new Date(createdAtMs).toLocaleString('zh-CN', { hour12: false }),
              createdAtMs,
              txHash,
            },
            ...current.stakes,
          ],
        }))
        return txHash
      },
      bindReferrer: (address: string, referrer: string) => {
        if (!address || !referrer || address.toLowerCase() === referrer.toLowerCase()) return
        const currentAccounts = getSimAccounts(readState().generatedAccounts)
        const canonicalAddress = getCanonicalSimAddress(address, currentAccounts)
        const canonicalReferrer = getCanonicalSimAddress(referrer, currentAccounts)

        updateState(current => ({
          ...current,
          referrals: {
            ...current.referrals,
            [canonicalAddress]: canonicalReferrer,
          },
        }))
      },
      unbindReferrer: (address: string) => {
        if (!address) return
        const currentAccounts = getSimAccounts(readState().generatedAccounts)
        const canonicalAddress = getCanonicalSimAddress(address, currentAccounts)

        window.localStorage.removeItem(getBoundReferrerStorageKey(canonicalAddress))
        updateState(current => {
          const referrals = { ...current.referrals }
          delete referrals[canonicalAddress]

          return {
            ...current,
            referrals,
          }
        })
      },
      claimReward: (orderId: string, amount: number) => {
        if (amount <= 0) return

        updateState(current => {
          const order = current.stakes.find(item => item.id === orderId)
          if (!order) return current

          const createdAtMs = Date.now()
          const createdAt = new Date(createdAtMs).toLocaleString('zh-CN', { hour12: false })
          const claimId = createTxHash()
          const claimPriceUsd = SIM_VVV_USD_PRICE
          const rewardConfig = readRewardConfig()
          const levelOverrides = readUserLevelOverrides()
          const sourceClaimAmountVvv = order.mode === 'coin' ? amount : amount / claimPriceUsd
          const sourceClaimAmountUsd = order.mode === 'coin' ? amount * claimPriceUsd : amount
          const uplines = getCompressedUplineAddresses(order.account, current.referrals, current.stakes)
          const sourceLevel = getTeamRewardLevel(
            order.account,
            current.referrals,
            current.stakes,
            rewardConfig.levelRates,
            rewardConfig.levelThresholds,
            levelOverrides,
          )
          let highestLevel = sourceLevel.level
          let highestRate = sourceLevel.rate
          const peerPaidLevels = new Set<number>()
          const levelRewards = uplines
            .map(beneficiary => {
              const rewardLevel = getTeamRewardLevel(
                beneficiary,
                current.referrals,
                current.stakes,
                rewardConfig.levelRates,
                rewardConfig.levelThresholds,
                levelOverrides,
              )
              let type: 'level' | 'peer' | null = null
              let rate = 0

              if (rewardLevel.level > highestLevel) {
                type = 'level'
                rate = Math.max(0, rewardLevel.rate - highestRate)
                highestLevel = rewardLevel.level
                highestRate = rewardLevel.rate
                peerPaidLevels.delete(rewardLevel.level)
              } else if (rewardLevel.level === highestLevel && !peerPaidLevels.has(rewardLevel.level)) {
                type = 'peer'
                rate = 10
                peerPaidLevels.add(rewardLevel.level)
              }

              if (!type || rate <= 0) return null

              return {
                id: createTxHash(),
                claimId,
                type,
                beneficiary,
                sourceAccount: order.account,
                sourceOrderId: order.id,
                sourceClaimAmount: amount,
                sourceClaimAmountVvv,
                rate,
                amount: sourceClaimAmountVvv * (rate / 100),
                claimed: false,
                createdAt,
                createdAtMs,
              }
            })
            .filter((reward): reward is NonNullable<typeof reward> => Boolean(reward))
          const generationRewards = uplines
            .slice(0, 3)
            .map((beneficiary, index) => {
              const rate = rewardConfig.generationRates[index]

              return {
                id: createTxHash(),
                claimId,
                type: 'generation' as const,
                generation: index + 1,
                beneficiary,
                sourceAccount: order.account,
                sourceOrderId: order.id,
                sourceClaimAmount: amount,
                sourceClaimAmountVvv,
                rate,
                amount: sourceClaimAmountVvv * (rate / 100),
                claimed: false,
                createdAt,
                createdAtMs,
              }
            })
            .filter(reward => reward.rate > 0)

          return {
            ...current,
            claims: [
              {
                id: claimId,
                orderId,
                account: order.account,
                amount,
                mode: order.mode,
                priceUsd: claimPriceUsd,
                amountVvv: sourceClaimAmountVvv,
                amountUsd: sourceClaimAmountUsd,
                createdAt,
                createdAtMs,
              },
              ...current.claims,
            ],
            teamRewards: [
              ...generationRewards,
              ...levelRewards,
              ...current.teamRewards,
            ],
          }
        })
      },
      claimTeamRewards: (beneficiary: string) => {
        const current = readState()
        const pendingAmount = current.teamRewards
          .filter(reward => !reward.claimed && reward.beneficiary.toLowerCase() === beneficiary.toLowerCase())
          .reduce((sum, reward) => sum + reward.amount, 0)

        if (pendingAmount <= 0) return 0

        const claimedAtMs = Date.now()
        const claimedAt = new Date(claimedAtMs).toLocaleString('zh-CN', { hour12: false })

        updateState(state => ({
          ...state,
          teamRewards: state.teamRewards.map(reward => (
            !reward.claimed && reward.beneficiary.toLowerCase() === beneficiary.toLowerCase()
              ? { ...reward, claimed: true, claimedAt, claimedAtMs }
              : reward
          )),
        }))

        return pendingAmount
      },
    }
  }, [state])

  return (
    <LocalWeb3SimContext.Provider value={value}>
      {children}
    </LocalWeb3SimContext.Provider>
  )
}

export function useLocalWeb3Sim() {
  const context = useContext(LocalWeb3SimContext)

  if (!context) {
    throw new Error('useLocalWeb3Sim must be used within LocalWeb3SimProvider')
  }

  return context
}
