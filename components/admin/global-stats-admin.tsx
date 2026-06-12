"use client";

import { useEffect, useState } from "react";
import { BarChart3, Gift, Loader2, RotateCcw, Save, TrendingUp, Users, Wallet, Zap } from "lucide-react";
import { useAccount } from "wagmi";
import { useGlobalStats, formatInteger, formatUsdFull, type GlobalStatsConfig } from "@/lib/global-stats";
import { useSetLevelThreshold, useSetLevelRate, useStakingOwner } from "@/lib/contract-hooks";
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
    stakedGrowthUsdPerHour: config.stakedGrowthUsdPerHour,
    claimedGrowthUsdPerHour: config.claimedGrowthUsdPerHour,
    stakersGrowthPerDay: config.stakersGrowthPerDay,
  };
}

function parseField(value: string, integer = false) {
  const next = Number(value);
  const safe = Number.isFinite(next) ? Math.max(0, next) : 0;
  return integer ? Math.floor(safe) : safe;
}

export function GlobalStatsAdmin() {
  const { config, computed, updateConfig, resetConfig } = useGlobalStats();
  const { toast } = useToast();
  const { address } = useAccount();

  // Owner check
  const chainOwner = useStakingOwner();
  const isOwner = address ? address.toLowerCase() === chainOwner.toLowerCase() : false;

  const [draft, setDraft] = useState<EditableGlobalStats>(() => toEditable(config));
  const [rewardDraft, setRewardDraft] = useState({
    generationRates: [15, 10, 5] as number[],
    levelRates: [10, 20, 30, 40, 50, 60, 70, 80] as number[],
    levelThresholds: [0, 10000, 30000, 50000, 100000, 300000, 500000, 1000000] as number[],
    periodRates: [0.7, 0.8, 0.9, 1.0] as number[],
    periodDurations: [7, 15, 30, 60] as number[],
    periodUnits: ["day", "day", "day", "day"] as string[],
  });

  useEffect(() => {
    setDraft(toEditable(config));
  }, [config]);

  // Fetch generation/period from DB API
  useEffect(() => {
    fetch("/api/config/reward")
      .then((r) => r.json())
      .then((data) => {
        setRewardDraft((prev) => ({
          ...prev,
          generationRates: data.generationRates ?? prev.generationRates,
          periodRates: data.periodRates ?? prev.periodRates,
          periodDurations: data.periodDurations ?? prev.periodDurations,
          periodUnits: data.periodUnits ?? prev.periodUnits,
        }));
      })
      .catch(() => {});
  }, []);

  // Fetch level config from chain via server-side API
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
      })
      .catch(() => {});
  }, []);

  // Write hooks
  const setLevelThreshold = useSetLevelThreshold();
  const setLevelRate = useSetLevelRate();

  const [batchWriting, setBatchWriting] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");

  const updateDraft = (key: keyof EditableGlobalStats, value: string, integer = false) => {
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
    updateConfig(draft);
    try {
      await fetch("/api/global-stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseStakedUsd: draft.baseStakedUsd,
          baseClaimedUsd: draft.baseClaimedUsd,
          baseStakers: draft.baseStakers,
          stakedGrowthUsdPerHour: draft.stakedGrowthUsdPerHour,
          claimedGrowthUsdPerHour: draft.claimedGrowthUsdPerHour,
          stakersGrowthPerDay: draft.stakersGrowthPerDay,
        }),
      });
      toast({ title: "增长设置已保存", description: "已同步至数据库，前端即时生效。" });
    } catch {
      toast({ title: "增长设置已保存（本地）", description: "数据库同步失败，仅本地生效。", variant: "destructive" });
    }
  };

  const [savingGeneration, setSavingGeneration] = useState(false);

  const handleSaveGenerationRates = async () => {
    setSavingGeneration(true);
    try {
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
      toast({ title: "邀请奖励比例已保存", description: "已写入数据库，即时生效。" });
    } catch {
      toast({ title: "保存失败", description: "请检查网络后重试", variant: "destructive" });
    } finally {
      setSavingGeneration(false);
    }
  };

  const handleReset = () => {
    resetConfig();
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleReset}><RotateCcw className="mr-2 h-4 w-4" />重置默认值</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-5 w-5 text-primary" />全网质押金额</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-foreground">{formatUsdFull(computed.displayStakedUsd)}</p><p className="mt-2 text-xs text-muted-foreground">真实质押 {formatUsdFull(computed.realStakedUsd)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Gift className="h-5 w-5 text-primary" />全网领取收益</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-foreground">{formatUsdFull(computed.displayClaimedUsd)}</p><p className="mt-2 text-xs text-muted-foreground">真实领取 {formatUsdFull(computed.realClaimedUsd)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card shadow-card">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5 text-primary" />质押地址数</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-foreground">{formatInteger(computed.displayStakers)}</p><p className="mt-2 text-xs text-muted-foreground">真实地址 {formatInteger(computed.realStakerCount)}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card className="border-border bg-card shadow-card">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5 text-primary" />真实数据统计</CardTitle><CardDescription>来自数据库真实质押和领取记录。</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-4"><span className="text-sm text-muted-foreground">真实质押金额</span><Badge variant="secondary">{formatUsdFull(computed.realStakedUsd)}</Badge></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4"><span className="text-sm text-muted-foreground">真实领取收益</span><Badge variant="secondary">{formatUsdFull(computed.realClaimedUsd)}</Badge></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4"><span className="text-sm text-muted-foreground">真实质押地址数</span><Badge variant="secondary">{formatInteger(computed.realStakerCount)}</Badge></div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-card">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5 text-primary" />数值与增长速度</CardTitle><CardDescription>保存后从当前时间重新开始按设置速度增长。</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>基础质押金额 USD</Label><Input type="number" min={0} value={draft.baseStakedUsd} onChange={(e) => updateDraft("baseStakedUsd", e.target.value)} /></div>
            <div className="space-y-2"><Label>基础领取收益 USD</Label><Input type="number" min={0} value={draft.baseClaimedUsd} onChange={(e) => updateDraft("baseClaimedUsd", e.target.value)} /></div>
            <div className="space-y-2"><Label>基础质押地址数</Label><Input type="number" min={0} step={1} value={draft.baseStakers} onChange={(e) => updateDraft("baseStakers", e.target.value, true)} /></div>
            <div className="space-y-2"><Label>地址增长速度 个/天</Label><Input type="number" min={0} step={1} value={draft.stakersGrowthPerDay} onChange={(e) => updateDraft("stakersGrowthPerDay", e.target.value, true)} /></div>
            <div className="space-y-2"><Label>质押金额增长速度 USD/小时</Label><Input type="number" min={0} value={draft.stakedGrowthUsdPerHour} onChange={(e) => updateDraft("stakedGrowthUsdPerHour", e.target.value)} /></div>
            <div className="space-y-2"><Label>领取收益增长速度 USD/小时</Label><Input type="number" min={0} value={draft.claimedGrowthUsdPerHour} onChange={(e) => updateDraft("claimedGrowthUsdPerHour", e.target.value)} /></div>
            <div className="sm:col-span-2">
              <Button className="w-full" onClick={handleSaveGrowth}>
                <Save className="mr-2 h-4 w-4" />保存增长设置
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card shadow-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Gift className="h-5 w-5 text-primary" />邀请奖励比例 (DB存储)</CardTitle><CardDescription>不考核团队业绩，按三代内成员领取的质押收益直接结算。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div className="space-y-2" key={i}>
                <Label>第{i + 1}代奖励比例 %</Label>
                <Input type="number" min={0} max={100} value={rewardDraft.generationRates[i]} onChange={(e) => updateGenerationRate(i as 0 | 1 | 2, e.target.value)} />
              </div>
            ))}
          </div>
          <Button className="w-full" disabled={savingGeneration} onClick={handleSaveGenerationRates}>
            <Save className="mr-2 h-4 w-4" />{savingGeneration ? '保存中...' : '保存邀请设置'}
          </Button>
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
