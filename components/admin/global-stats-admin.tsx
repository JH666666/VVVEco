"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, Gift, Loader2, RotateCcw, Save, TrendingUp, Users, Wallet, Zap } from "lucide-react";
import { useAccount } from "wagmi";
import { useGlobalStats, formatInteger, formatUsdFull, type GlobalStatsConfig } from "@/lib/global-stats";
import { useSetLevelThreshold, useSetLevelRate, useSetDurationRate, useSetInviteRate, useDurationRate, useStakingOwner } from "@/lib/contract-hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type EditableGlobalStats = Omit<GlobalStatsConfig, "updatedAtMs">;

function toEditable(config: GlobalStatsConfig): EditableGlobalStats {
  return {
    baseStakedUsd: config.baseStakedUsd,
    baseClaimedUsd: config.baseClaimedUsd,
    baseStakers: config.baseStakers,
    stakedMinPerEvent: config.stakedMinPerEvent,
    stakedMaxPerEvent: config.stakedMaxPerEvent,
    claimedMinPerEvent: config.claimedMinPerEvent,
    claimedMaxPerEvent: config.claimedMaxPerEvent,
    stakersMinPerEvent: config.stakersMinPerEvent,
    stakersMaxPerEvent: config.stakersMaxPerEvent,
    eventsPerHour: config.eventsPerHour,
  };
}

function parseField(value: string, integer = false) {
  const next = Number(value);
  const safe = Number.isFinite(next) ? Math.max(0, next) : 0;
  return integer ? Math.floor(safe) : safe;
}

export function GlobalStatsAdmin() {
  const { config, computed, updateConfig } = useGlobalStats();
  const { toast } = useToast();
  const { address } = useAccount();

  // Owner check
  const chainOwner = useStakingOwner();
  const isOwner = address ? address.toLowerCase() === chainOwner.toLowerCase() : false;

  const [draft, setDraft] = useState<EditableGlobalStats>(() => toEditable(config));
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  // Track which base fields the admin has explicitly edited since last load/save
  const dirtyBaseFields = useRef<Set<'baseStakedUsd' | 'baseClaimedUsd' | 'baseStakers'>>(new Set());
  const [rewardDraft, setRewardDraft] = useState({
    generationRates: [15, 10, 5] as number[],
    levelRates: [10, 20, 30, 40, 50, 60, 70, 80] as number[],
    levelThresholds: [0, 10000, 30000, 50000, 100000, 300000, 500000, 1000000] as number[],
    periodRates: [0.7, 0.8, 0.9, 1.0] as number[],
    periodDurations: [7, 15, 30, 60] as number[],
    periodUnits: ["day", "day", "day", "day"] as string[],
  });
  // 只在 DB 加载 / 同步成功后更新，不随输入框实时变化
  const [savedDurations, setSavedDurations] = useState([7, 15, 30, 60]);

  // One-time fetch to populate form with real DB values on mount
  useEffect(() => {
    fetch("/api/global-stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          const c = data.config;
          setDraft({
            baseStakedUsd: Number(c.baseStakedUsd) || 0,
            baseClaimedUsd: Number(c.baseClaimedUsd) || 0,
            baseStakers: Math.floor(Number(c.baseStakers)) || 0,
            stakedMinPerEvent: Number(c.stakedMinPerEvent) || 100,
            stakedMaxPerEvent: Number(c.stakedMaxPerEvent) || 500,
            claimedMinPerEvent: Number(c.claimedMinPerEvent) || 10,
            claimedMaxPerEvent: Number(c.claimedMaxPerEvent) || 100,
            stakersMinPerEvent: Math.floor(Number(c.stakersMinPerEvent)) || 1,
            stakersMaxPerEvent: Math.floor(Number(c.stakersMaxPerEvent)) || 5,
            eventsPerHour: Number(c.eventsPerHour) || 10,
          });
        }
      })
      .catch(() => {})
      .finally(() => setIsConfigLoading(false));
  }, []); // empty deps: runs exactly once on mount, never overwrites user input

  // Fetch generation/period from DB API
  useEffect(() => {
    fetch("/api/config/reward")
      .then((r) => r.json())
      .then((data) => {
        const durations = data.periodDurations ?? [7, 15, 30, 60];
        setSavedDurations(durations);
        setRewardDraft((prev) => ({
          ...prev,
          generationRates: data.generationRates ?? prev.generationRates,
          periodRates: data.periodRates ?? prev.periodRates,
          periodDurations: durations,
          periodUnits: data.periodUnits ?? prev.periodUnits,
        }));
      })
      .catch(() => {});
  }, []);

  // chain invite rates: undefined=loading, null=RPC failed, number=ok (index 0=gen1,1=gen2,2=gen3)
  const [chainInviteRates, setChainInviteRates] = useState<(number | null | undefined)[]>([undefined, undefined, undefined]);

  // Fetch level + invite config from chain
  useEffect(() => {
    fetch("/api/config/level-config")
      .then((r) => r.json())
      .then((data) => {
        if (data.levelThresholds && data.levelRates) {
          setRewardDraft((prev) => ({
            ...prev,
            levelThresholds: data.levelThresholds,
            levelRates: data.levelRates,
          }));
        }
        if (Array.isArray(data.inviteRates)) {
          setChainInviteRates(data.inviteRates);
        }
      })
      .catch(() => {
        setChainInviteRates([null, null, null]);
      });
  }, []);

  // Read on-chain duration rates using savedDurations (DB state), staggered to avoid 429
  const chainRate0 = useDurationRate(savedDurations[0] || 7,    0);
  const chainRate1 = useDurationRate(savedDurations[1] || 15, 400);
  const chainRate2 = useDurationRate(savedDurations[2] || 30, 800);
  const chainRate3 = useDurationRate(savedDurations[3] || 60, 1200);
  const chainRates = [chainRate0, chainRate1, chainRate2, chainRate3];

  // Write hooks
  const setLevelThreshold = useSetLevelThreshold();
  const setLevelRate = useSetLevelRate();
  const setDurationRate = useSetDurationRate();
  const setInviteRate = useSetInviteRate();

  const [batchWriting, setBatchWriting] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");

  const BASE_KEYS = ['baseStakedUsd', 'baseClaimedUsd', 'baseStakers'] as const;
  type BaseKey = typeof BASE_KEYS[number];

  const updateDraft = (key: keyof EditableGlobalStats, value: string, integer = false) => {
    if ((BASE_KEYS as readonly string[]).includes(key)) {
      dirtyBaseFields.current.add(key as BaseKey);
    }
    setDraft((current) => ({ ...current, [key]: parseField(value, integer) }));
  };

  const updateGenerationRate = (index: 0 | 1 | 2, value: string) => {
    const next = Number(value);
    const safe = Number.isFinite(next) ? Math.min(100, Math.max(0, next)) : 0;
    setRewardDraft((current) => {
      const generationRates = [...current.generationRates] as [number, number, number];
      generationRates[index] = safe;
      return { ...current, generationRates };
    });
  };

  const updateLevelRateLocal = (index: number, value: string) => {
    const next = Number(value);
    const safe = Number.isFinite(next) ? Math.min(100, Math.max(0, next)) : 0;
    setRewardDraft((current) => {
      const levelRates = [...current.levelRates];
      levelRates[index] = safe;
      return { ...current, levelRates };
    });
  };

  const updateLevelThresholdLocal = (index: number, value: string) => {
    const next = Number(value);
    const safe = Number.isFinite(next) ? Math.max(0, next) : 0;
    setRewardDraft((current) => {
      const levelThresholds = [...current.levelThresholds];
      levelThresholds[index] = safe;
      return { ...current, levelThresholds };
    });
  };

  // ═══════════ Write to Chain ═══════════
  const handleBatchWriteAll = async () => {
    if (!isOwner) {
      toast({ title: "权限不足", description: "仅 Owner 可批量写入链上", variant: "destructive" });
      return;
    }
    setBatchWriting(true);
    let successCount = 0;
    let failCount = 0;
    for (let level = 1; level <= 8; level++) {
      try {
        setBatchProgress(`V${level}/8 收益比例...`);
        await setLevelRate(level, rewardDraft.levelRates[level - 1]);
        successCount++;
      } catch {
        failCount++;
        toast({ title: `V${level} 收益比例保存失败`, variant: "destructive" });
      }
      try {
        setBatchProgress(`V${level}/8 等级门槛...`);
        await setLevelThreshold(level, rewardDraft.levelThresholds[level - 1]);
        successCount++;
      } catch {
        failCount++;
        toast({ title: `V${level} 等级门槛保存失败`, variant: "destructive" });
      }
    }
    setBatchWriting(false);
    setBatchProgress("");
    toast({
      title: failCount === 0 ? "全部等级配置已更新" : `完成（${failCount} 项失败）`,
      description: `成功 ${successCount} 项，失败 ${failCount} 项`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  const handleSaveLevelRate = async (level: number) => {
    if (!isOwner) {
      toast({ title: "权限不足", description: `链上 Owner: ${chainOwner.slice(0, 6)}...${chainOwner.slice(-4)}`, variant: "destructive" });
      return;
    }
    try {
      const rate = rewardDraft.levelRates[level - 1];
      toast({ title: `V${level} 收益比例写入中...请在钱包确认` });
      await setLevelRate(level, rate);
      toast({ title: `V${level} 收益比例已更新`, description: `setLevelRate(${level}, ${rate})` });
    } catch (e: unknown) {
      toast({ title: "写入失败", description: (e as Error)?.message?.slice(0, 100), variant: "destructive" });
    }
  };

  const handleSaveLevelThreshold = async (level: number) => {
    if (!isOwner) {
      toast({ title: "权限不足", description: `链上 Owner: ${chainOwner.slice(0, 6)}...${chainOwner.slice(-4)}`, variant: "destructive" });
      return;
    }
    try {
      const threshold = rewardDraft.levelThresholds[level - 1];
      toast({ title: `V${level} 业绩门槛写入中...请在钱包确认` });
      await setLevelThreshold(level, threshold);
      toast({ title: `V${level} 升级门槛已更新`, description: `setLevelThreshold(${level}, ${threshold})` });
    } catch (e: unknown) {
      toast({ title: "写入失败", description: (e as Error)?.message?.slice(0, 100), variant: "destructive" });
    }
  };

  const handleSaveGrowth = async () => {
    // For each base field:
    //   - Admin explicitly changed it → use admin's input (respect intent)
    //   - Admin did NOT change it (only changed growth params) → absorb accumulated
    //     autoGrowth into base so display doesn't drop after updatedAt resets.
    //     Formula: newBase = currentDisplay - real  (real is re-added by computeGlobalStats)
    const dirty = dirtyBaseFields.current;
    const resolvedBase = {
      baseStakedUsd: dirty.has('baseStakedUsd')
        ? draft.baseStakedUsd
        : Math.floor(Math.max(0, computed.displayStakedUsd - computed.realStakedUsd)),
      baseClaimedUsd: dirty.has('baseClaimedUsd')
        ? draft.baseClaimedUsd
        : Math.floor(Math.max(0, computed.displayClaimedUsd - computed.realClaimedUsd)),
      baseStakers: dirty.has('baseStakers')
        ? draft.baseStakers
        : Math.floor(Math.max(0, computed.displayStakers - computed.realStakerCount)),
    };
    const payload = { ...draft, ...resolvedBase };
    updateConfig(payload);
    setDraft((d) => ({ ...d, ...resolvedBase }));
    dirtyBaseFields.current = new Set(); // reset after save
    try {
      await fetch("/api/global-stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast({ title: "随机增长设置已保存", description: "基准已更新，官网展示值不会回落。" });
    } catch {
      toast({ title: "随机增长设置已保存（本地）", description: "数据库同步失败，仅本地生效。", variant: "destructive" });
    }
  };

  const [resettingGrowth, setResettingGrowth] = useState(false);
  const handleResetGrowth = async () => {
    setResettingGrowth(true);
    try {
      // Send current draft base values as-is (do NOT absorb auto-growth into base)
      // updatedAt = now is set automatically by the API, so auto resets to 0
      updateConfig(draft);
      dirtyBaseFields.current = new Set();
      await fetch("/api/global-stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      toast({ title: "累积增长已清空", description: "计时基准已重置，展示值将从基础数值重新开始增长。" });
    } catch {
      toast({ title: "清空失败", description: "请检查网络后重试", variant: "destructive" });
    } finally {
      setResettingGrowth(false);
    }
  };

  const [savingGeneration, setSavingGeneration] = useState(false);
  const [savingInviteProgress, setSavingInviteProgress] = useState("");
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [savingPeriodProgress, setSavingPeriodProgress] = useState("");

  const handleSyncInviteRates = async () => {
    if (!isOwner) {
      toast({ title: "权限不足", description: `链上 Owner: ${chainOwner.slice(0, 6)}...${chainOwner.slice(-4)}`, variant: "destructive" });
      return;
    }
    setSavingGeneration(true);
    try {
      // 依次写 3 笔链上交易，任意失败立即抛出，DB 不更新
      for (let gen = 1; gen <= 3; gen++) {
        const rate = rewardDraft.generationRates[gen - 1];
        setSavingInviteProgress(`${gen}/3 Gen${gen}: ${rate}%`);
        toast({ title: `邀请奖励 ${gen}/3 写入链上...`, description: `请在钱包确认: setInviteRate(${gen}, ${rate})` });
        await setInviteRate(gen, rate);
      }
      // 全部成功后写 DB
      setSavingInviteProgress("写入 DB...");
      await fetch("/api/config/reward", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationRates: rewardDraft.generationRates,
          periodRates: rewardDraft.periodRates,
          periodDurations: rewardDraft.periodDurations,
          periodUnits: rewardDraft.periodUnits,
        }),
      });
      // 更新本地链上显示值
      setChainInviteRates([...rewardDraft.generationRates]);
      toast({ title: "邀请奖励已同步", description: "链上 3 笔交易和 DB 均已更新。" });
    } catch (e: unknown) {
      toast({ title: "写入失败，DB 未更新", description: (e as Error)?.message?.slice(0, 120), variant: "destructive" });
    } finally {
      setSavingGeneration(false);
      setSavingInviteProgress("");
    }
  };

  const updatePeriodDuration = (index: number, value: string) => {
    const next = Math.max(1, Math.floor(Number(value) || 1));
    setRewardDraft((current) => {
      const periodDurations = [...current.periodDurations];
      periodDurations[index] = next;
      return { ...current, periodDurations };
    });
  };

  const updatePeriodRate = (index: number, value: string) => {
    const next = Number(value);
    const safe = Number.isFinite(next) ? Math.max(0, next) : 0;
    setRewardDraft((current) => {
      const periodRates = [...current.periodRates];
      periodRates[index] = safe;
      return { ...current, periodRates };
    });
  };

  const handleSavePeriodConfig = async () => {
    if (!isOwner) {
      toast({ title: "权限不足", description: `链上 Owner: ${chainOwner.slice(0, 6)}...${chainOwner.slice(-4)}`, variant: "destructive" });
      return;
    }
    const durations = rewardDraft.periodDurations;
    const rates = rewardDraft.periodRates;
    for (let i = 0; i < 4; i++) {
      if (durations[i] <= 0 || rates[i] <= 0) {
        toast({ title: "校验失败", description: `第${i + 1}行：天数和利率必须大于0`, variant: "destructive" });
        return;
      }
    }
    if (new Set(durations).size < 4) {
      toast({ title: "校验失败", description: "周期天数不能重复", variant: "destructive" });
      return;
    }
    setSavingPeriod(true);
    try {
      for (let i = 0; i < 4; i++) {
        const durationDays = durations[i];
        const ratePermille = Math.round(rates[i] * 10);
        setSavingPeriodProgress(`${i + 1}/4 (${durationDays}天 / ${rates[i]}%/天)`);
        toast({ title: `周期 ${i + 1}/4 写入链上...`, description: `请在钱包确认：setDurationRate(${durationDays}, ${ratePermille})` });
        await setDurationRate(durationDays, ratePermille);
      }
      setSavingPeriodProgress("写入DB...");
      await fetch("/api/config/reward", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationRates: rewardDraft.generationRates,
          periodRates: rewardDraft.periodRates,
          periodDurations: rewardDraft.periodDurations,
          periodUnits: rewardDraft.periodUnits,
        }),
      });
      setSavedDurations([...rewardDraft.periodDurations]);
      toast({ title: "周期配置已同步", description: "链上 4 笔交易和 DB 均已更新。" });
    } catch (e: unknown) {
      toast({ title: "写入失败，DB 未更新", description: (e as Error)?.message?.slice(0, 120), variant: "destructive" });
    } finally {
      setSavingPeriod(false);
      setSavingPeriodProgress("");
    }
  };


  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">全球数据管理台</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            管理全网展示数据、增长速度，并自动叠加真实质押和领取统计。
            {chainOwner && (
              <span className={isOwner ? "text-green-500 ml-2" : "text-red-500 ml-2"}>
                {isOwner ? "✅ Owner 已连接" : `⚠️ 非Owner (链上: ${chainOwner.slice(0, 6)}...${chainOwner.slice(-4)})`}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-5 w-5 text-primary" />全网质押金额</CardTitle></CardHeader>
          <CardContent>
            {isConfigLoading ? <div className="h-8 w-32 rounded bg-muted animate-pulse" /> : <p className="text-2xl font-semibold text-foreground">{formatUsdFull(computed.displayStakedUsd)}</p>}
            <p className="mt-2 text-xs text-muted-foreground">真实质押 {formatUsdFull(computed.realStakedUsd)}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Gift className="h-5 w-5 text-primary" />全网领取收益</CardTitle></CardHeader>
          <CardContent>
            {isConfigLoading ? <div className="h-8 w-32 rounded bg-muted animate-pulse" /> : <p className="text-2xl font-semibold text-foreground">{formatUsdFull(computed.displayClaimedUsd)}</p>}
            <p className="mt-2 text-xs text-muted-foreground">真实领取 {formatUsdFull(computed.realClaimedUsd)}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5 text-primary" />质押地址数</CardTitle></CardHeader>
          <CardContent>
            {isConfigLoading ? <div className="h-8 w-20 rounded bg-muted animate-pulse" /> : <p className="text-2xl font-semibold text-foreground">{formatInteger(computed.displayStakers)}</p>}
            <p className="mt-2 text-xs text-muted-foreground">真实地址 {formatInteger(computed.realStakerCount)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card className="border-border bg-card shadow-card">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5 text-primary" />真实数据统计</CardTitle><CardDescription>来自数据库真实质押和领取记录。</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-4"><span className="text-sm text-muted-foreground">真实质押金额</span><Badge variant="secondary">{formatUsdFull(computed.realStakedUsd)}</Badge></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4"><span className="text-sm text-muted-foreground">真实领取收益</span><Badge variant="secondary">{formatUsdFull(computed.realClaimedUsd)}</Badge></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4"><span className="text-sm text-muted-foreground">真实待领取收益</span><Badge variant="secondary">{formatUsdFull(computed.realPendingUsd)}</Badge></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4"><span className="text-sm text-muted-foreground">真实质押地址数</span><Badge variant="secondary">{formatInteger(computed.realStakerCount)}</Badge></div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-card">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5 text-primary" />随机增长模型</CardTitle><CardDescription>保存后时间基准重置，新增量按每次随机事件叠加。真实 DB 数据自动叠加到展示值。</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {isConfigLoading && <div className="sm:col-span-2 h-64 rounded-lg bg-muted animate-pulse" />}
            {!isConfigLoading && <>
            <div className="space-y-2"><Label>基础质押金额 USD</Label><Input type="number" min={0} step={100} value={draft.baseStakedUsd} onChange={(e) => updateDraft("baseStakedUsd", e.target.value)} /></div>
            <div className="space-y-2"><Label>基础领取收益 USD</Label><Input type="number" min={0} step={10} value={draft.baseClaimedUsd} onChange={(e) => updateDraft("baseClaimedUsd", e.target.value)} /></div>
            <div className="space-y-2"><Label>基础质押地址数</Label><Input type="number" min={0} step={1} value={draft.baseStakers} onChange={(e) => updateDraft("baseStakers", e.target.value, true)} /></div>
            <div className="space-y-2"><Label>每小时事件次数</Label><Input type="number" min={1} step={1} value={draft.eventsPerHour} onChange={(e) => updateDraft("eventsPerHour", e.target.value)} /></div>
            <div className="space-y-2"><Label>质押单次最小 USD</Label><Input type="number" min={0} step={100} value={draft.stakedMinPerEvent} onChange={(e) => updateDraft("stakedMinPerEvent", e.target.value)} /></div>
            <div className="space-y-2"><Label>质押单次最大 USD</Label><Input type="number" min={0} step={100} value={draft.stakedMaxPerEvent} onChange={(e) => updateDraft("stakedMaxPerEvent", e.target.value)} /></div>
            <div className="space-y-2"><Label>领取单次最小 USD</Label><Input type="number" min={0} step={10} value={draft.claimedMinPerEvent} onChange={(e) => updateDraft("claimedMinPerEvent", e.target.value)} /></div>
            <div className="space-y-2"><Label>领取单次最大 USD</Label><Input type="number" min={0} step={10} value={draft.claimedMaxPerEvent} onChange={(e) => updateDraft("claimedMaxPerEvent", e.target.value)} /></div>
            <div className="space-y-2"><Label>地址单次最小 个</Label><Input type="number" min={0} step={1} value={draft.stakersMinPerEvent} onChange={(e) => updateDraft("stakersMinPerEvent", e.target.value, true)} /></div>
            <div className="space-y-2"><Label>地址单次最大 个</Label><Input type="number" min={0} step={1} value={draft.stakersMaxPerEvent} onChange={(e) => updateDraft("stakersMaxPerEvent", e.target.value, true)} /></div>
            <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
              <Button className="w-full" onClick={handleSaveGrowth}>
                <Save className="mr-2 h-4 w-4" />保存随机增长设置
              </Button>
              <Button
                className="w-full"
                variant="outline"
                disabled={resettingGrowth}
                onClick={handleResetGrowth}
              >
                {resettingGrowth
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />清空中...</>
                  : <><RotateCcw className="mr-2 h-4 w-4" />清空累积增长</>
                }
              </Button>
            </div>
            </>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card shadow-card">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><Gift className="h-5 w-5 text-primary" />邀请奖励比例 (链上+DB同步)</CardTitle>
              <CardDescription className="mt-1">修改后点击"同步到链上"，依次写入 3 笔链上交易，全部成功后写入 DB。⚠️ 仅 Owner 可操作。当前: {isOwner ? "✅ Owner" : "🔴 非Owner"}</CardDescription>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Button
                disabled={!isOwner || savingGeneration}
                onClick={handleSyncInviteRates}
                className="gap-2 whitespace-nowrap"
              >
                {savingGeneration
                  ? <><Loader2 className="h-4 w-4 animate-spin" />写入中...</>
                  : <><Save className="h-4 w-4" />同步到链上</>
                }
              </Button>
              {savingGeneration && savingInviteProgress && (
                <p className="text-xs text-muted-foreground">正在处理 {savingInviteProgress}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left font-medium text-muted-foreground w-16">代数</th>
                  <th className="pb-2 px-2 text-left font-medium text-muted-foreground">奖励比例 % (输入)</th>
                  <th className="pb-2 px-2 text-left font-medium text-muted-foreground">链上当前值</th>
                  <th className="pb-2 text-left font-medium text-muted-foreground">同步状态</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2].map((i) => {
                  const chainVal = chainInviteRates[i];
                  const dbVal = rewardDraft.generationRates[i];
                  const isSynced = typeof chainVal === "number" && chainVal === dbVal;
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 text-muted-foreground">Gen{i + 1}</td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="h-8 w-24"
                          value={dbVal}
                          onChange={(e) => updateGenerationRate(i as 0 | 1 | 2, e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-2 text-muted-foreground font-mono text-sm">
                        {chainVal === undefined
                          ? <span className="text-xs text-muted-foreground">读取中...</span>
                          : chainVal === null
                            ? <span className="text-xs text-red-500">读取失败</span>
                            : <span>{chainVal}%</span>
                        }
                      </td>
                      <td className="py-2">
                        {chainVal === undefined
                          ? <span className="text-xs text-muted-foreground">-</span>
                          : chainVal === null
                            ? <span className="text-xs text-red-400">RPC 失败</span>
                            : isSynced
                              ? <span className="text-green-500 text-xs">✅ 已同步</span>
                              : <span className="text-amber-500 text-xs">⚠️ 未同步</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-card">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><Zap className="h-5 w-5 text-primary" />质押周期配置 (链上+DB同步)</CardTitle>
              <CardDescription className="mt-1">修改后点击"同步到链上"，串行写入4笔交易，全部成功后写入DB。⚠️ 仅 Owner 可操作。当前: {isOwner ? "✅ Owner" : "🔴 非Owner"}</CardDescription>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Button
                disabled={!isOwner || savingPeriod}
                onClick={handleSavePeriodConfig}
                className="gap-2 whitespace-nowrap"
              >
                {savingPeriod
                  ? <><Loader2 className="h-4 w-4 animate-spin" />写入中...</>
                  : <><Save className="h-4 w-4" />同步到链上</>
                }
              </Button>
              {savingPeriod && savingPeriodProgress && (
                <p className="text-xs text-muted-foreground">正在处理 {savingPeriodProgress}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left font-medium text-muted-foreground w-10">周期</th>
                  <th className="pb-2 px-2 text-left font-medium text-muted-foreground">天数</th>
                  <th className="pb-2 px-2 text-left font-medium text-muted-foreground">利率 %/天 (DB)</th>
                  <th className="pb-2 px-2 text-left font-medium text-muted-foreground">链上周期/利率</th>
                  <th className="pb-2 text-left font-medium text-muted-foreground">同步状态</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3].map((i) => {
                  const chainRate = chainRates[i];  // undefined=加载中, null=失败, number=成功
                  const dbRate = rewardDraft.periodRates[i];
                  const daysChanged = rewardDraft.periodDurations[i] !== savedDurations[i];
                  const isSynced = !daysChanged && typeof chainRate === 'number' && Math.round(chainRate * 10) === Math.round(dbRate * 10);
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 text-muted-foreground">P{i + 1}</td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          className="h-8 w-24"
                          value={rewardDraft.periodDurations[i]}
                          onChange={(e) => updatePeriodDuration(i, e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          className="h-8 w-28"
                          value={rewardDraft.periodRates[i]}
                          onChange={(e) => updatePeriodRate(i, e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-2 text-muted-foreground font-mono text-sm">
                        {chainRate === undefined
                          ? <span className="text-xs text-muted-foreground">读取中...</span>
                          : chainRate === null
                            ? <span className="text-xs text-red-500">读取失败</span>
                            : <span>{savedDurations[i]}天 / {chainRate}%</span>
                        }
                      </td>
                      <td className="py-2">
                        {chainRate === undefined
                          ? <span className="text-xs text-muted-foreground">-</span>
                          : chainRate === null
                            ? <span className="text-xs text-red-400">RPC 失败</span>
                            : isSynced
                              ? <span className="text-green-500 text-xs">✅ 已同步</span>
                              : <span className="text-amber-500 text-xs">⚠️ 未同步</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-card">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5 text-primary" />团队等级收益比例 (链上存储)</CardTitle>
              <CardDescription className="mt-1">修改配置后点击对应等级按钮保存，或使用批量同步一次完成全部更新。⚠️ 仅 Owner 可操作。当前: {isOwner ? "✅ Owner" : "🔴 非Owner"}</CardDescription>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Button
                disabled={!isOwner || batchWriting}
                onClick={handleBatchWriteAll}
                className="gap-2 whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white"
              >
                {batchWriting
                  ? <><Loader2 className="h-4 w-4 animate-spin" />写入中...</>
                  : <><Zap className="h-4 w-4" />一键同步全部等级配置</>
                }
              </Button>
              {batchWriting && batchProgress && (
                <p className="text-xs text-muted-foreground">正在处理 {batchProgress}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rewardDraft.levelRates.map((rate, index) => (
            <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3" key={`level-rate-${index}`}>
              <p className="text-sm font-medium text-foreground">V{index + 1}</p>
              <div className="space-y-2">
                <Label>收益比例 %</Label>
                <Input type="number" min={0} max={100} value={rate} onChange={(e) => updateLevelRateLocal(index, e.target.value)} />
                <Button size="sm" className="w-full" disabled={!isOwner || batchWriting} onClick={() => handleSaveLevelRate(index + 1)}>
                  保存收益比例
                </Button>
              </div>
              <div className="space-y-2">
                <Label>质押业绩 USD</Label>
                <Input type="number" min={0} value={rewardDraft.levelThresholds[index]} onChange={(e) => updateLevelThresholdLocal(index, e.target.value)} />
                <Button size="sm" className="w-full" disabled={!isOwner || batchWriting} onClick={() => handleSaveLevelThreshold(index + 1)}>
                  保存等级门槛
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
