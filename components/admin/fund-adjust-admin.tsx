"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

// 出金核对加成系数（仅内部股东核对用）。设 5 表示资金报表里出金三项
// （领取收益 / 团队奖励 / 赎回本金）各放大 5%，累计出金随之 ×1.05。
export function FundAdjustAdmin() {
  const { toast } = useToast();
  const [pct, setPct] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/config/fund-adjust")
      .then((r) => r.json())
      .then((d) => setPct(String(d.withdrawMarkupPct ?? 0)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const value = Number(pct);
    if (!Number.isFinite(value) || value < 0) {
      toast({ title: "请输入 ≥ 0 的数字", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/config/fund-adjust", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawMarkupPct: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setPct(String(data.withdrawMarkupPct));
      toast({ title: "已保存", description: `出金核对加成：+${data.withdrawMarkupPct}%` });
    } catch (e) {
      toast({ title: "保存失败", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4" /> 出金核对加成系数
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          仅用于内部股东核对：资金报表里「累计出金」的三项（领取收益 / 团队奖励 / 赎回本金）
          会按此系数放大。例如填 5 表示各 +5%，累计出金随之 ×1.05，净额相应变化。
          入金、有效质押不受影响；填 0 表示不加成（按真实值）。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-[180px]">
            <Label className="text-xs text-muted-foreground">加成百分比（%）</Label>
            <Input
              type="number"
              min={0}
              step="0.5"
              value={pct}
              disabled={loading}
              onChange={(e) => setPct(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button onClick={handleSave} disabled={loading || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
