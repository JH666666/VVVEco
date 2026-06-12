"use client";

import { useState, useEffect, useCallback } from "react";
import { useReadContract, useWriteContract, useAccount, useChainId } from "wagmi";
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
  return null;
}

// Base Sepolia deployed addresses — env var takes priority, hardcoded fallback prevents zero-address bugs
export const VVV_TOKEN_ADDR = (process.env.NEXT_PUBLIC_VVV_TOKEN || "0xf857F4BaeF1503262c20156457e1336BA37BA495") as `0x${string}`;
export const STAKING_ADDR = (process.env.NEXT_PUBLIC_VVECO_STAKING || "0xf1F2A60EdD2110a42F5Ec9d760348C0fB4Bc1659") as `0x${string}`;

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
  "function setMockPrice(uint256 newPrice)",
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
    chainId: 84532,
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
    if (!address || chainId !== 84532) {
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
      // 2. 备用：公共 RPC
      for (const rpc of [
        'https://sepolia.base.org',
        'https://base-sepolia-rpc.publicnode.com',
        'https://rpc.ankr.com/base_sepolia',
      ]) {
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

// ═══════════════ Read Staking ═══════════════
export function useLatestPrice() {
  const { data } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "getLatestPrice",
    chainId: 84532,
  });
  return (data as bigint) ?? parseEther("0.2");
}

export function useLatestPriceData() {
  const { data, refetch } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "getLatestPrice",
    chainId: 84532,
  });
  return { price: (data as bigint) ?? 0n, refetch };
}

export function useSetMockPrice() {
  const { writeContractAsync } = useWriteContract();
  return async (newPrice: bigint) => {
    return writeContractAsync({
      address: STAKING_ADDR,
      abi: STAKING_ABI,
      functionName: "setMockPrice",
      args: [newPrice],
    });
  };
}

export function useMinStakeUsd() {
  const { data } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "minStakeUsd",
  });
  return (data as bigint) ?? 0n;
}

export function useDurationRate(days: number) {
  const { data } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "durationRates",
    args: [BigInt(days)],
  });
  return data ? Number(data) / 10 : undefined;
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

export function useStakingOwner() {
  const { data } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "owner",
  });
  return (data as string) ?? "";
}

export function useStakingOwnerData() {
  const { data, refetch, isPending, isError } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: "owner",
    chainId: 84532,
    query: { retry: 3, retryDelay: 1500 },
  });
  return { owner: (data as string) ?? "", refetch, isPending, isError };
}

export function useTransferOwnership() {
  const { writeContractAsync } = useWriteContract();
  return async (newOwner: `0x${string}`) => {
    return writeContractAsync({
      address: STAKING_ADDR,
      abi: STAKING_ABI,
      functionName: "transferOwnership",
      args: [newOwner],
    });
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
  return async (orderId: bigint) => {
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
    const receipt = await waitForRawReceipt(txHash);
    return { txHash, logs: receipt?.logs ?? [] };
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
  const { writeContractAsync } = useWriteContract();
  return async (level: number, thresholdUsd: number) => {
    return writeContractAsync({
      address: STAKING_ADDR,
      abi: STAKING_ABI,
      functionName: "setLevelThreshold",
      args: [level, BigInt(Math.floor(thresholdUsd * 1e18))],
    });
  };
}

export function useSetLevelRate() {
  const { writeContractAsync } = useWriteContract();
  return async (level: number, rate: number) => {
    return writeContractAsync({
      address: STAKING_ADDR,
      abi: STAKING_ABI,
      functionName: "setLevelRate",
      args: [level, BigInt(rate)],
    });
  };
}

// Admin write hooks
export function useSetFreezeStatus() {
  const { writeContractAsync } = useWriteContract();
  return async (target: string, frozen: boolean) => {
    return writeContractAsync({
      address: STAKING_ADDR,
      abi: STAKING_ABI,
      functionName: "setFreezeStatus",
      args: [target as `0x${string}`, frozen],
    });
  };
}

export function useSetFeePercent() {
  const { writeContractAsync } = useWriteContract();
  return async (fee: number) => {
    return writeContractAsync({
      address: STAKING_ADDR,
      abi: STAKING_ABI,
      functionName: "setFeePercent",
      args: [BigInt(fee)],
    });
  };
}

export function useSetProjectWallet() {
  const { writeContractAsync } = useWriteContract();
  return async (wallet: string) => {
    return writeContractAsync({
      address: STAKING_ADDR,
      abi: STAKING_ABI,
      functionName: "setProjectWallet",
      args: [wallet as `0x${string}`],
    });
  };
}

export function useSetFeeWallet() {
  const { writeContractAsync } = useWriteContract();
  return async (wallet: string) => {
    return writeContractAsync({
      address: STAKING_ADDR,
      abi: STAKING_ABI,
      functionName: "setFeeWallet",
      args: [wallet as `0x${string}`],
    });
  };
}

export function useSetOwner() {
  const { writeContractAsync } = useWriteContract();
  return async (newOwner: string) => {
    return writeContractAsync({
      address: STAKING_ADDR,
      abi: STAKING_ABI,
      functionName: "transferOwnership",
      args: [newOwner as `0x${string}`],
    });
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
    query: { refetchInterval: 15_000 },
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
