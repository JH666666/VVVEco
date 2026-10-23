"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface WhitelistItem {
  address: string;
  note: string | null;
  createdAt: string | null;
}

// 资金报表查询白名单：只有这里添加的地址，才能在 /query 查询系统里查到数据。
export function QueryWhitelistAdmin() {
  const { toast } = useToast();
  const [items, setItems] = useState<WhitelistItem[]>([]);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = () => {
    fetch("/api/admin/query-whitelist")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const addr = address.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/i.test(addr)) {
      toast({ title: "地址格式不正确", description: "需 0x 开头的 42 位地址", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/query-whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "添加失败");
      setItems(Array.isArray(data.items) ? data.items : []);
      setAddress("");
      setNote("");
      toast({ title: "已添加", description: `${addr} 可查询了` });
    } catch (e) {
      toast({ title: "添加失败", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (addr: string) => {
    if (!window.confirm(`确认移除 ${addr}？移除后该地址将无法在查询系统查看。`)) return;
    try {
      const res = await fetch(`/api/admin/query-whitelist?address=${encodeURIComponent(addr)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "移除失败");
      setItems(Array.isArray(data.items) ? data.items : []);
      toast({ title: "已移除", description: addr });
    } catch (e) {
      toast({ title: "移除失败", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" /> 资金报表查询白名单
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          只有加入白名单的地址，才能在查询系统（/query）里查到对应的资金报表。
          白名单为空时，任何地址都查不到。添加/移除即时生效。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">钱包地址</label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="mt-1 font-mono"
            />
          </div>
          <div className="w-full sm:w-44">
            <label className="text-xs text-muted-foreground">备注（可选）</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如：股东A"
              className="mt-1"
            />
          </div>
          <Button onClick={handleAdd} disabled={adding} className="gap-2">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            添加
          </Button>
        </div>

        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <span>已授权地址</span>
            <span>共 {items.length} 个</span>
          </div>
          {loading ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">加载中…</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">暂无白名单地址，当前无人能查询</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((it) => (
                <div key={it.address} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-foreground">{it.address}</p>
                    {it.note ? <p className="truncate text-xs text-muted-foreground">{it.note}</p> : null}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemove(it.address)}
                    className="shrink-0 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
