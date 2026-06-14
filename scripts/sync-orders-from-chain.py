#!/usr/bin/env python3
"""
sync-orders-from-chain.py
将 stake_orders 表中的 amount/usd_value/daily_rate/mode/start_time/end_time
与链上 getOrder() 权威数据对齐。

运行: python3 scripts/sync-orders-from-chain.py
"""

import sqlite3
import json
import subprocess
import os
import sys
from datetime import datetime, timezone

# ── 配置 ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.path.join(PROJECT_DIR, "prisma", "dev.db")

STAKING_ADDR = "0x707AeF5E4331c45F1b11aA50EB452b396cE69DD9"
# 按可用性排列，脚本依次尝试
RPC_URLS = [
    "https://base-sepolia-rpc.publicnode.com",
    "https://sepolia.base.org",
]
MATCH_TOL_SEC = 120  # 2分钟匹配容差

# 读取 env（.env 先，.env.local 后，后者优先级更高覆盖前者）
env_vals = {}
for env_file in [".env", ".env.local"]:
    env_path = os.path.join(PROJECT_DIR, env_file)
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env_vals[k.strip()] = v.strip().strip('"').strip("'")

if env_vals.get("NEXT_PUBLIC_VVECO_STAKING"):
    STAKING_ADDR = env_vals["NEXT_PUBLIC_VVECO_STAKING"]

print(f"合约地址: {STAKING_ADDR}")
print(f"RPC列表: {RPC_URLS}")

# ── 链上 RPC（用 curl 避免 Python urllib 被限流）─────────────────────────────
def eth_call(data_hex):
    payload = json.dumps({
        "jsonrpc": "2.0", "id": 1, "method": "eth_call",
        "params": [{"to": STAKING_ADDR, "data": data_hex}, "latest"]
    })
    for rpc in RPC_URLS:
        try:
            result = subprocess.run(
                ["curl", "-s", "-X", "POST", rpc,
                 "-H", "Content-Type: application/json",
                 "-d", payload, "--max-time", "15"],
                capture_output=True, text=True, timeout=20
            )
            if result.returncode == 0 and result.stdout:
                data = json.loads(result.stdout)
                r = data.get("result")
                if r and r != "0x":
                    return r
        except Exception:
            continue
    raise RuntimeError("所有 RPC 均失败")

def pad32(val):
    return hex(val)[2:].zfill(64)

def get_orders_length(wallet):
    # ordersLength(address) selector: 0x2ad601c8
    data = "0x2ad601c8" + pad32(int(wallet, 16))
    result = eth_call(data)
    return int(result, 16) if result and result != "0x" else 0

def get_order(wallet, order_id):
    # getOrder(address,uint256) selector: 0xedb25841
    data = "0xedb25841" + pad32(int(wallet, 16)) + pad32(order_id)
    result = eth_call(data)
    if not result or result == "0x":
        return None
    # Decode: 9 words of 32 bytes each
    raw = result[2:]
    if len(raw) < 9 * 64:
        return None
    words = [int(raw[i:i+64], 16) for i in range(0, 9 * 64, 64)]
    vvv_amount_in  = words[0] / 1e18
    usd_value      = words[1] / 1e18
    start_ts       = words[2]
    end_ts         = words[3]
    duration       = words[4]
    rate_permille  = words[5]
    is_coin_based  = bool(words[6])
    return {
        "orderId":       order_id,
        "vvvAmountIn":   vvv_amount_in,
        "usdValue":      usd_value,
        "startTime":     datetime.fromtimestamp(start_ts, tz=timezone.utc),
        "endTime":       datetime.fromtimestamp(end_ts, tz=timezone.utc),
        "duration":      duration,
        "dailyRatePct":  rate_permille / 10,
        "isCoinBased":   is_coin_based,
    }

def get_all_chain_orders(wallet):
    length = get_orders_length(wallet)
    orders = []
    for i in range(length):
        o = get_order(wallet, i)
        if o:
            orders.append(o)
    return orders

# ── 主逻辑 ───────────────────────────────────────────────────────────────────
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

wallets = [r["wallet_address"] for r in
           cur.execute("SELECT DISTINCT wallet_address FROM stake_orders").fetchall()]

print(f"\n共 {len(wallets)} 个地址，开始同步...\n")

total_updated = 0
total_skipped = 0
total_unmatched = 0

for wallet in wallets:
    db_orders = cur.execute(
        "SELECT * FROM stake_orders WHERE wallet_address=? ORDER BY start_time ASC",
        (wallet,)
    ).fetchall()

    try:
        chain_orders = get_all_chain_orders(wallet)
    except Exception as e:
        print(f"  {wallet[:10]}...: 链上读取失败 → {e}")
        total_unmatched += len(db_orders)
        continue

    print(f"  {wallet[:10]}...: DB {len(db_orders)} 笔 | 链上 {len(chain_orders)} 笔")

    for row in db_orders:
        db_start = datetime.fromisoformat(
            row["start_time"].replace("Z", "+00:00")
        )
        db_start_ts = db_start.timestamp()

        # 找最近匹配的链上订单
        best = None
        best_diff = float("inf")
        for co in chain_orders:
            diff = abs(co["startTime"].timestamp() - db_start_ts)
            if diff < best_diff:
                best_diff = diff
                best = co

        if best is None or best_diff > MATCH_TOL_SEC:
            print(f"    ⚠ 未匹配: {row['tx_hash'][:12]}... (dbStart={row['start_time']})")
            total_unmatched += 1
            continue

        new_mode = "coin" if best["isCoinBased"] else "fiat"
        same = (
            abs(row["amount"] - best["vvvAmountIn"]) < 0.001 and
            abs(row["usd_value"] - best["usdValue"]) < 0.001 and
            abs(row["daily_rate"] - best["dailyRatePct"]) < 0.0001 and
            row["mode"] == new_mode
        )

        if same:
            total_skipped += 1
            continue

        cur.execute("""
            UPDATE stake_orders
            SET amount=?, usd_value=?, daily_rate=?, mode=?, start_time=?, end_time=?
            WHERE tx_hash=?
        """, (
            best["vvvAmountIn"],
            best["usdValue"],
            best["dailyRatePct"],
            new_mode,
            best["startTime"].isoformat(),
            best["endTime"].isoformat(),
            row["tx_hash"],
        ))
        conn.commit()

        print(f"    ✓ 更新: amount {row['amount']}→{best['vvvAmountIn']:.4f}"
              f"  usdValue {row['usd_value']}→{best['usdValue']:.4f}"
              f"  mode {row['mode']}→{new_mode}")
        total_updated += 1

print(f"\n完成: 更新 {total_updated} 笔 | 已一致跳过 {total_skipped} 笔 | 未匹配 {total_unmatched} 笔")
conn.close()
