"use client";

import { useState, useEffect, useCallback } from "react";
import { useReadContract, useReadContracts, useWriteContract, useAccount, useChainId } from "wagmi";
import { parseEther, formatEther, encodeFunctionData, parseAbi } from "viem";

type RawLog = { topics: string[]; data: string; address: string; logIndex?: string };
type RawReceipt = { status: string; logs: RawLog[] };

// 等待 tx 被打包：轮询 eth_getTransactionReceipt，最多等 120 秒，返回 receipt
async function waitForRawReceipt(txHash: string, maxWaitMs = 120_000): Promise<RawReceipt | null> {
  const eth = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>).ethereum : null;
  if (!eth) return null;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const receipt = await (eth as { request: (args: unknown) => Promise<unknown> }).request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }) as RawReceipt | null;
      if (receipt) {
        if (receipt.status === "0x0") throw new Error("交易在链上执行失败（revert）");
        return receipt;
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("revert")) throw e;
      /* ignore polling errors */
    }
  }
  throw new Error("交易等待超时，请在钱包中确认是否已上链");
}

// Base Mainnet deployed addresses — env var takes priority, hardcoded fallback prevents zero-address bugs
export const VVV_TOKEN_ADDR = (process.env.NEXT_PUBLIC_VVV_TOKEN || "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf") as `0x${string}`;
export const STAKING_ADDR   = (process.env.NEXT_PUBLIC_VVECO_STAKING  || "0x5ec768D99Cdc49a95E29811Ce97a313f294EBC64") as `0x${string}`;
export const PAYOUT_ADDR    = (process.env.NEXT_PUBLIC_VVECO_PAYOUT   || "0x35FAac6Da16345A51437dE4b9a9D0571418fCA36") as `0x${string}`;
export const TREASURY_ADDR  = (process.env.NEXT_PUBLIC_VVECO_TREASURY || "0xcfdca5D4B975BE97321a84160Be89d9dd2f33601") as `0x${string}`;

const VVV_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

const STAKING_ABI = [
  // ── Write ─────────────────────────────────────────────────────────────
  "function stake(uint256 vvvAmount, uint256 duration, bool isCoinBased, address referrer)",
  "function claimOrderReward(uint256 orderId)",
  "function claimAllRewards()",
  "function withdrawOrderPrincipal(uint256 orderId)",
  "function claimTeamReward()",                               // NEW: 领取团队+邀请奖励
  // ── Read: staking config ───────────────────────────────────────────────
  "function getLatestPrice() view returns (uint256)",
  "function minStakeUsd() view returns (uint256)",
  "function durationRates(uint256) view returns (uint256)",
  "function accountFrozen(address) view returns (bool)",      // 原 isFrozen (public mapping)
  "function vvvToken() view returns (address)",
  "function owner() view returns (address)",
  "function rootReferrer() view returns (address)",           // NEW
  "function levelThresholds(uint256) view returns (uint256)",
  "function levelRates(uint256) view returns (uint256)",
  "function inviteRates(uint256) view returns (uint256)",     // NEW
  // ── Read: user data ────────────────────────────────────────────────────
  "function users(address) view returns (tuple(address referrer, uint256 teamVolume7, uint8 level, uint256 rewardClaimed))", // NEW
  "function pendingTeamReward(address) view returns (uint256)", // NEW
  // ── Read: orders ───────────────────────────────────────────────────────
  "function ordersLength(address user) view returns (uint256)",
  // 新合约 Order struct: 9 字段 (新增 vvvAmountIn, usdValue)
  "function getOrder(address user, uint256 orderId) view returns (tuple(uint256 vvvAmountIn, uint256 usdValue, uint256 startTime, uint256 endTime, uint256 duration, uint256 rate, bool isCoinBased, bool isWithdrawn, uint256 claimedAmount))",
  "function getPendingReward(address user, uint256 orderId) view returns (uint256)",
  "function getAllPendingRewards(address user) view returns (uint256)",
  "function hasActiveOrder(address user) view returns (bool)", // NEW
  // ── Admin write ────────────────────────────────────────────────────────
  "function setLevelThreshold(uint8 level, uint256 threshold)",
  "function setLevelRate(uint8 level, uint256 rate)",
  "function setFreezeStatus(address target, bool frozen)",
  "function setMinStakeUsd(uint256 min)",
  "function setProjectWallet(address newWallet)",
  "function setFeeWallet(address newWallet)",
  "function setFeePercent(uint256 newFee)",               // admin-compat (Payout侧费率，保留签名)
  "function transferOwnership(address newOwner)",
] as const;

// ═══════════════ Balance & Allowance ═══════════════
export function useVVVBalance() {
  const { address } = useAccount();
  const { data } = useReadContract({
    address: VVV_TOKEN_ADDR,
    abi: VVV_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: 8453,
  });
  return (data as bigint) ?? 0n;
}

export function useVVVBalanceData() {
  const { address } = useAccount();
  const chainId = useChainId();
  const [balance, setBalance] = useState<bigint>(0n);
  const [isPending, setIsPending] = useState(false);
  const [isError, setIsError] = useState(false);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!address || chainId !== 8453) {
      setBalance(0n); setIsPending(false); setIsError(false); return;
    }
    let cancelled = false;
    setIsPending(true); setIsError(false);
    const calldata = `0x70a08231${address.slice(2).toLowerCase().padStart(64, '0')}`;

    (async () => {
      // 1. 优先用钱包注入的 provider，加 5s 超时防止挂起
      const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;
      if (eth) {
        try {
          const hex: string = await Promise.race([
            eth.request({ method: 'eth_call', params: [{ to: VVV_TOKEN_ADDR, data: calldata }, 'latest'] }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
          ]);
          if (!cancelled) {
            setBalance(hex && hex !== '0x' ? BigInt(hex) : 0n);
            setIsPending(false);
            return;
          }
        } catch (e) { console.warn('[balance] wallet provider failed:', e); }
      }
      // 2. 备用：优先 Alchemy，再 fallback 公共节点
      const rpcList = [
        process.env.NEXT_PUBLIC_BASE_MAINNET_RPC,
        'https://mainnet.base.org',
        'https://base-rpc.publicnode.com',
      ].filter(Boolean) as string[];
      for (const rpc of rpcList) {
        if (cancelled) return;
        try {
          const res = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: VVV_TOKEN_ADDR, data: calldata }, 'latest'] }),
          });
          const json = await res.json();
          if (!cancelled && json.result && json.result !== '0x') {
            setBalance(BigInt(json.result));
            setIsPending(false);
            return;
          }
        } catch {}
      }
      if (!cancelled) { setIsError(true); setIsPending(false); }
    })();

    return () => { cancelled = true; };
  }, [address, chainId, tick]);

  return { balance, isPending: !!address && isPending, isError, refetch };
}

export function useVVVAllowance(spender: `0x${string}`) {
  const { address } = useAccount();
  const { data } = useReadContract({
    address: VVV_TOKEN_ADDR,
    abi: VVV_ABI,
    functionName: "allowance",
    args: address && spender ? [address, spender] : undefined,
  });
  return (data as bigint) ?? 0n;
}

const PRICE_CACHE_KEY = "vvveco-price";

// ═══════════════ Read Staking ═══════════════
export function useLatestPrice() {
  const [price, setPrice] = useState<bigint>(() => {
    // 初始值读 localStorage 缓存，避免切换页面时闪现 fallback 价格
    if (typeof window === "undefined") return 0n;
    const cached = window.localStorage.getItem(PRICE_CACHE_KEY);
    return cached ? parseEther(cached) : 0n;
  });
  useEffect(() => {
    fetch("/api/admin/chain-params")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.currentPrice) {
          setPrice(parseEther(d.currentPrice));
          window.localStorage.setItem(PRICE_CACHE_KEY, String(d.currentPrice));
        }
      })
      .catch(() => {});
  }, []);
  return price;
}

export function useLatestPriceData() {
  const { data, refetch } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "getLatestPrice",
    chainId: 8453,
  });
  return { price: (data as bigint) ?? 0n, refetch };
}

export function useMinStakeUsd() {
  const { data, refetch } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "minStakeUsd",
    chainId: 8453,
    query: { retry: 3, retryDelay: 1500 },
  });
  return { value: (data as bigint) ?? 0n, refetch };
}

// undefined = loading, null = failed, number = success
export function useDurationRate(days: number, delayMs = 0) {
  const [rate, setRate] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    setRate(undefined);
    if (!days) return;
    let cancelled = false;
    const controller = new AbortController();
    const run = async () => {
      if (delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
        if (cancelled) return;
      }
      const calldata = '0x2b9e3b25' + BigInt(days).toString(16).padStart(64, '0');
      const body = JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: STAKING_ADDR, data: calldata }, 'latest'],
      });
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const rpc = process.env.NEXT_PUBLIC_BASE_MAINNET_RPC ?? 'https://mainnet.base.org';
        const res = await fetch(rpc, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body, signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (res.status === 429) { setRate(null); return; }
        const json = await res.json();
        if (cancelled) return;
        if (json?.error) { setRate(null); return; }
        const hex = json?.result;
        if (hex && hex !== '0x') setRate(Number(BigInt(hex)) / 10);
        else setRate(null);
      } catch {
        if (!cancelled) setRate(null);
      }
    };
    run();
    return () => { cancelled = true; controller.abort(); };
  }, [days, delayMs]);
  return rate;
}

export function useIsFrozen(wallet?: `0x${string}`) {
  const { address } = useAccount();
  const target = wallet ?? address;
  const { data } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "accountFrozen", // 新合约 public mapping 名称
    args: target ? [target] : undefined,
  });
  return (data as boolean) ?? false;
}

// ═══════════════ Level Config (Read) ═══════════════
export function useLevelThreshold(level: number) {
  const { data } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "levelThresholds",
    args: [BigInt(level)],
  });
  return data ? Number(data) / 1e18 : undefined;
}

export function useLevelRate(level: number) {
  const { data } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "levelRates",
    args: [BigInt(level)],
  });
  return data ? Number(data) : undefined;
}

const OWNER_ABI = [{ name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }] as const;

const PROJECT_WALLET_ABI = [{ name: "projectWallet", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }] as const;
const FEE_WALLET_ABI = [{ name: "feeWallet", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }] as const;

export function useStakingProjectWallet() {
  // projectWallet() is on VVVTreasury, NOT VVVEcoStaking
  const { data, isPending, isError, refetch } = useReadContract({ address: TREASURY_ADDR, abi: PROJECT_WALLET_ABI, functionName: "projectWallet", chainId: 8453 });
  return {
    projectWallet: (data as string | undefined) ?? "",
    refetch: async () => { await refetch(); },
    isPending,
    isError,
  };
}

export function useStakingFeeWallet() {
  // feeWallet() is on VVVPayout, NOT VVVEcoStaking
  const { data, isPending, isError, refetch } = useReadContract({ address: PAYOUT_ADDR, abi: FEE_WALLET_ABI, functionName: "feeWallet", chainId: 8453 });
  return {
    feeWallet: (data as string | undefined) ?? "",
    refetch: async () => { await refetch(); },
    isPending,
    isError,
  };
}

export function useStakingOwner() {
  const { data } = useReadContract({ address: STAKING_ADDR, abi: OWNER_ABI, functionName: "owner", chainId: 8453 });
  return (data as string | undefined) ?? "";
}

export function useStakingOwnerData() {
  const { data, isPending, isError, refetch } = useReadContract({ address: STAKING_ADDR, abi: OWNER_ABI, functionName: "owner", chainId: 8453 });
  return {
    owner: (data as string | undefined) ?? "",
    refetch: async () => { await refetch(); },
    isPending,
    isError,
  };
}

export function useTransferOwnership() {
  const { address } = useAccount();
  return async (newOwner: `0x${string}`) => {
    const data = encodeFunctionData({
      abi: parseAbi(["function transferOwnership(address newOwner)"]),
      functionName: "transferOwnership",
      args: [newOwner],
    });
    return sendAdminTx(address, STAKING_ADDR, data);
  };
}

// ═══════════════ Write ═══════════════
// 直接用 window.ethereum.request 绕过 wagmi/viem 的错误处理，
// 避免 TP Wallet 等非标准 WebView 中 '"name" in e' TypeError 崩溃。
export function useApproveVVV() {
  const { address } = useAccount();
  return async (amount: bigint) => {
    const eth = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>).ethereum : null;
    if (!eth) throw new Error("未找到钱包，请使用钱包浏览器访问");
    const data = encodeFunctionData({
      abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
      functionName: "approve",
      args: [STAKING_ADDR, amount],
    });
    const txHash = await (eth as { request: (args: unknown) => Promise<string> }).request({
      method: "eth_sendTransaction",
      params: [{ from: address, to: VVV_TOKEN_ADDR, data }],
    });
    await waitForRawReceipt(txHash);
    return txHash;
  };
}

export function useStake() {
  const { address } = useAccount();
  return async (amount: bigint, duration: number, isCoinBased: boolean, referrer: `0x${string}`) => {
    const eth = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>).ethereum : null;
    if (!eth) throw new Error("未找到钱包，请使用钱包浏览器访问");
    const data = encodeFunctionData({
      abi: parseAbi(["function stake(uint256 vvvAmount, uint256 duration, bool isCoinBased, address referrer)"]),
      functionName: "stake",
      args: [amount, BigInt(duration), isCoinBased, referrer],
    });
    const txHash = await (eth as { request: (args: unknown) => Promise<string> }).request({
      method: "eth_sendTransaction",
      params: [{ from: address, to: STAKING_ADDR, data }],
    });
    await waitForRawReceipt(txHash);
    return txHash;
  };
}

export function useClaimRewards() {
  const { address } = useAccount();
  return async (orderId: bigint, pendingReward?: number) => {
    console.log('[claim] start', { functionName: 'claimOrderReward', args: [orderId.toString()], userAddress: address, pendingReward });
    const eth = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>).ethereum : null;
    if (!eth) throw new Error("未找到钱包，请使用钱包浏览器访问");
    const data = encodeFunctionData({
      abi: parseAbi(["function claimOrderReward(uint256 orderId)"]),
      functionName: "claimOrderReward",
      args: [orderId],
    });
    const txHash = await (eth as { request: (args: unknown) => Promise<string> }).request({
      method: "eth_sendTransaction",
      params: [{ from: address, to: STAKING_ADDR, data }],
    });
    console.log('[claim] txHash:', txHash);
    if (!txHash) throw new Error("交易未提交，钱包未返回交易 hash");
    const receipt = await waitForRawReceipt(txHash);
    if (!receipt) throw new Error("交易确认失败，未获取到链上回执");
    if (receipt.status !== "0x1") throw new Error(`交易执行失败（status=${receipt.status}）`);
    console.log('[claim] receipt.status:', receipt.status, 'logs count:', receipt.logs?.length ?? 0);
    return { txHash, logs: receipt.logs ?? [] };
  };
}

export function useWithdrawPrincipal() {
  const { address } = useAccount();
  return async (orderId: bigint) => {
    const eth = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>).ethereum : null;
    if (!eth) throw new Error("未找到钱包，请使用钱包浏览器访问");
    const data = encodeFunctionData({
      abi: parseAbi(["function withdrawOrderPrincipal(uint256 orderId)"]),
      functionName: "withdrawOrderPrincipal",
      args: [orderId],
    });
    const txHash = await (eth as { request: (args: unknown) => Promise<string> }).request({
      method: "eth_sendTransaction",
      params: [{ from: address, to: STAKING_ADDR, data }],
    });
    await waitForRawReceipt(txHash);
    return txHash;
  };
}

export function useSetLevelThreshold() {
  const { address } = useAccount();
  return async (level: number, thresholdUsd: number) => {
    const data = encodeFunctionData({
      abi: parseAbi(["function setLevelThreshold(uint256 level, uint256 threshold)"]),
      functionName: "setLevelThreshold",
      args: [BigInt(level), BigInt(Math.floor(thresholdUsd * 1e18))],
    });
    return sendAdminTx(address, STAKING_ADDR, data);
  };
}

export function useSetLevelRate() {
  const { address } = useAccount();
  return async (level: number, rate: number) => {
    const data = encodeFunctionData({
      abi: parseAbi(["function setLevelRate(uint256 level, uint256 rate)"]),
      functionName: "setLevelRate",
      args: [BigInt(level), BigInt(rate)],
    });
    return sendAdminTx(address, STAKING_ADDR, data);
  };
}

// Admin write hooks — use window.ethereum.request + encodeFunctionData to avoid wagmi string-ABI parse error
function getEth() {
  const eth = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>).ethereum : null;
  if (!eth) throw new Error("未找到钱包，请使用钱包浏览器访问");
  return eth as { request: (args: unknown) => Promise<string> };
}

// 发送管理员交易：显式带 nonce，让 TP 钱包把每次调用视为独立交易，避免 "duplicate call detected" 去重误判
async function sendAdminTx(from: string | undefined, to: string, data: string): Promise<string> {
  const eth = getEth();
  // wagmi 未接管 admin 钱包时 from 为 undefined，回退到 eth_accounts 取当前账户
  if (!from) {
    const accounts = (await eth.request({ method: "eth_accounts" } as unknown as Parameters<typeof eth.request>[0])) as unknown as string[];
    from = accounts?.[0];
  }
  const txHash = await eth.request({ method: "eth_sendTransaction", params: [{ from, to, data }] });
  await waitForRawReceipt(txHash);
  return txHash;
}

export function useSetFreezeStatus() {
  const { address } = useAccount();
  return async (target: string, frozen: boolean) => {
    const data = encodeFunctionData({
      abi: parseAbi(["function setFreezeStatus(address target, bool frozen)"]),
      functionName: "setFreezeStatus",
      args: [target as `0x${string}`, frozen],
    });
    return sendAdminTx(address, STAKING_ADDR, data);
  };
}

export function useSetFeePercent() {
  const { address } = useAccount();
  return async (fee: number) => {
    const data = encodeFunctionData({
      abi: parseAbi(["function setFeePercent(uint256 _pct)"]),
      functionName: "setFeePercent",
      args: [BigInt(fee)],
    });
    return sendAdminTx(address, PAYOUT_ADDR, data);
  };
}

export function useSetProjectWallet() {
  const { address } = useAccount();
  return async (wallet: string) => {
    const data = encodeFunctionData({
      abi: parseAbi(["function setProjectWallet(address _wallet)"]),
      functionName: "setProjectWallet",
      args: [wallet as `0x${string}`],
    });
    return sendAdminTx(address, TREASURY_ADDR, data);
  };
}

export function useSetFeeWallet() {
  const { address } = useAccount();
  return async (wallet: string) => {
    const data = encodeFunctionData({
      abi: parseAbi(["function setFeeWallet(address _wallet)"]),
      functionName: "setFeeWallet",
      args: [wallet as `0x${string}`],
    });
    return sendAdminTx(address, PAYOUT_ADDR, data);
  };
}

export function useRescueETH() {
  const { address } = useAccount();
  return async (amount: bigint) => {
    const data = encodeFunctionData({
      abi: parseAbi(["function rescueETH(uint256 amount) external"]),
      functionName: "rescueETH",
      args: [amount],
    });
    return sendAdminTx(address, PAYOUT_ADDR, data);
  };
}

export function useFlushQueue() {
  const { address } = useAccount();
  return async (user: string) => {
    const data = encodeFunctionData({
      abi: parseAbi(["function flushQueue(address user)"]),
      functionName: "flushQueue",
      args: [user as `0x${string}`],
    });
    return sendAdminTx(address, PAYOUT_ADDR, data);
  };
}

export function useSetInviteRate() {
  const { address } = useAccount();
  return async (gen: number, rate: number) => {
    const data = encodeFunctionData({
      abi: parseAbi(["function setInviteRate(uint256 gen, uint256 rate)"]),
      functionName: "setInviteRate",
      args: [BigInt(gen), BigInt(rate)],
    });
    return sendAdminTx(address, STAKING_ADDR, data);
  };
}

export function useSetOwner() {
  const { address } = useAccount();
  return async (newOwner: string) => {
    const data = encodeFunctionData({
      abi: parseAbi(["function transferOwnership(address newOwner)"]),
      functionName: "transferOwnership",
      args: [newOwner as `0x${string}`],
    });
    return sendAdminTx(address, STAKING_ADDR, data);
  };
}

export function useSetMinStakeUsd() {
  const { address } = useAccount();
  return async (minUsd: number) => {
    const data = encodeFunctionData({
      abi: parseAbi(["function setMinStakeUsd(uint256 min)"]),
      functionName: "setMinStakeUsd",
      args: [BigInt(Math.round(minUsd)) * BigInt("1000000000000000000")],
    });
    return sendAdminTx(address, STAKING_ADDR, data);
  };
}

export function useSetDurationRate() {
  const { address } = useAccount();
  // ratePermille = dailyRatePct * 10  (e.g. 1% → 10)
  return async (durationDays: number, ratePermille: number) => {
    const data = encodeFunctionData({
      abi: parseAbi(["function setDurationRate(uint256 _durationDays, uint256 _rateNew)"]),
      functionName: "setDurationRate",
      args: [BigInt(durationDays), BigInt(ratePermille)],
    });
    return sendAdminTx(address, STAKING_ADDR, data);
  };
}

// ═══════════════ Order Read Hooks (new) ═══════════════

export function useOrdersLength(user?: `0x${string}`) {
  const { address } = useAccount();
  const target = user ?? address;
  const { data } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "ordersLength",
    args: target ? [target] : undefined,
  });
  return data ? Number(data) : 0;
}

export function useAllPendingRewards(user?: `0x${string}`) {
  const { address } = useAccount();
  const target = user ?? address;
  const { data, refetch } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "getAllPendingRewards",
    args: target ? [target] : undefined,
  });
  return { pendingVvv: (data as bigint) ?? 0n, refetch };
}

export function usePendingRewardForOrder(orderId: number, user?: `0x${string}`) {
  const { address } = useAccount();
  const target = user ?? address;
  const { data } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "getPendingReward",
    args: target ? [target, BigInt(orderId)] : undefined,
  });
  return (data as bigint) ?? 0n;
}

/**
 * 批量读取某地址所有订单（orderId 0..count-1）的链上待领取（VVV gross）。
 * 返回数组：索引 = orderId，值 = 待领取 VVV（bigint）；读取失败的项为 undefined。
 * 用链上权威值替代"时间累计−数据库领取记录"，避免领取记录写库失败导致待领取卡住。
 */
const GET_PENDING_READ_ABI = parseAbi([
  "function getPendingReward(address user, uint256 orderId) view returns (uint256)",
]);

export function useOrdersPendingRewards(count: number, user?: `0x${string}`) {
  const { address } = useAccount();
  const target = user ?? address;
  const contracts = target && count > 0
    ? Array.from({ length: count }, (_, i) => ({
        address: STAKING_ADDR,
        abi: GET_PENDING_READ_ABI,
        functionName: "getPendingReward" as const,
        args: [target, BigInt(i)] as const,
        chainId: 8453,
      }))
    : [];
  const { data, dataUpdatedAt, refetch } = useReadContracts({
    contracts,
    query: { enabled: !!target && count > 0, refetchInterval: 30_000 },
  });
  const pendings = (data ?? []).map((r) =>
    r.status === "success" ? (r.result as bigint) : undefined
  );
  // dataUpdatedAt: 链上数据最近一次成功读取的时间戳；用于两次读取之间做平滑累计
  // refetch: 领取成功后立即重新读链上，让待领取马上归零
  return { pendings, dataUpdatedAt, refetch };
}

// ═══════════════ NEW: Team Reward Hooks ═══════════════

/** 读取地址在链上累计的待领取团队奖励（VVV gross，领取时扣 10% 费） */
export function usePendingTeamReward(user?: `0x${string}`) {
  const { address } = useAccount();
  const target = user ?? address;
  const { data, refetch } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "pendingTeamReward",
    args: target ? [target] : undefined,
    query: { refetchInterval: 60_000 },
  });
  return { pendingVvv: (data as bigint) ?? 0n, refetch };
}

/** 调用合约 claimTeamReward()，通过 VVVPayout 发放，扣 10% 手续费 */
export function useClaimTeamReward() {
  const { address } = useAccount();
  return async () => {
    const eth = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>).ethereum : null;
    if (!eth) throw new Error("未找到钱包，请使用钱包浏览器访问");
    const data = encodeFunctionData({
      abi: parseAbi(["function claimTeamReward()"]),
      functionName: "claimTeamReward",
    });
    const txHash = await (eth as { request: (args: unknown) => Promise<string> }).request({
      method: "eth_sendTransaction",
      params: [{ from: address, to: STAKING_ADDR, data }],
    });
    await waitForRawReceipt(txHash);
    return txHash;
  };
}

/** 读取链上 users(address) 结构体，返回 referrer / teamVolume7 / level / rewardClaimed */
export function useUserOnChainInfo(user?: `0x${string}`) {
  const { address } = useAccount();
  const target = user ?? address;
  const { data } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "users",
    args: target ? [target] : undefined,
  });
  return data as
    | { referrer: string; teamVolume7: bigint; level: number; rewardClaimed: bigint }
    | undefined;
}

/** 读取合约的 rootReferrer 地址 */
export function useRootReferrer() {
  const { data } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "rootReferrer",
  });
  return (data as string) ?? "";
}

/** 读取链上历史累计团队奖励：聚合 TeamRewardAccrued(recipient=user) 事件的 bonus 总和
 *  使用公共 RPC 分段查询（max 2000 blocks/req），移动端和桌面均可用 */
export function useTeamRewardsTotal(user?: `0x${string}`) {
  const { address } = useAccount();
  const target = user ?? address;
  const [total, setTotal] = useState<bigint>(0n);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;

    async function load() {
      try {
        // 通过服务端 API 查询，避免移动端浏览器 CORS 限制
        const res  = await fetch(`/api/team-rewards/total?wallet=${(target as string).toLowerCase()}`);
        const json = await res.json() as { total: string };
        if (!cancelled) setTotal(BigInt(json.total ?? "0"));
      } catch {
        // keep previous value on error
      }
    }

    load();
    const timer = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [target]);

  return total;
}

// ═══════════════ Helpers ═══════════════

export function vvvToUsd(vvvAmount: bigint, price: bigint): number {
  return Number((vvvAmount * price) / parseEther("1")) / 1e18;
}

export function usdToVvv(usdAmount: number, price: bigint): bigint {
  return (BigInt(Math.floor(usdAmount * 1e18)) * parseEther("1")) / price;
}
