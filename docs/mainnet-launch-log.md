# VVVEco Mainnet Launch Log

## 2026-06-15 — AerodromeAdapter 修复 & 主网领取上线

### 问题描述

用户点击领取后提示「处理中」，VVV 一直未到账。链上查看到每笔 claim tx 都触发了 `PayoutQueued`（"quote failed" / "swap failed"），而非预期的 `RewardPaid`。

### 根本原因

Aerodrome Router（`0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43`）在 Base 主网上**不实现以下两个接口**，调用均 silent revert：

| 函数 | 说明 |
|---|---|
| `getAmountsIn(uint256, Route[])` | 精确输出报价 |
| `swapETHForExactTokens(uint256, Route[], address, uint256)` | 精确输出 ETH→Token 兑换 |

Aerodrome 仅支持精确输入（`swapExactETHForTokens` / `getAmountsOut`）。

VVVPayout `_tryExecute` 调用链：
```
VVVPayout._tryExecute()
  → AerodromeAdapter.getAmountsIn()     // revert → PayoutQueued("quote failed")
  → AerodromeAdapter.swapETHForExactTokens()  // revert → PayoutQueued("swap failed")
```

### 修复方案

修改 `contracts/AerodromeAdapter.sol`，不改 VVVPayout / VVVEcoStaking：

**`getAmountsIn`** — 改为直接读 pool reserves + factory fee，用 volatile AMM 公式计算：
```solidity
amountIn = reserveIn * amountOut * 10000 / ((reserveOut - amountOut) * (10000 - feeBps)) + 1
```

**`swapETHForExactTokens`** — 改为调用 `aeroRouter.swapExactETHForTokens`，将全部 `msg.value` 作为精确输入，`amountOut` 作为 `amountOutMin`：
```solidity
amounts = aeroRouter.swapExactETHForTokens{value: msg.value}(amountOut, routes, to, deadline);
```

`getAmountsIn` 向上取整 +1 wei，确保同一笔 tx 内 `swapExactETHForTokens` 输出永远 ≥ `amountOut`。

### 新增接口

`contracts/IAerodromeRouter.sol` 中新增：
```solidity
function swapExactETHForTokens(
    uint256 amountOutMin,
    Route[] calldata routes,
    address to,
    uint256 deadline
) external payable returns (uint256[] memory amounts);
```

### 部署记录

| 项目 | 值 |
|---|---|
| 网络 | Base Mainnet (chainId: 8453) |
| 旧 AerodromeAdapter | `0xf354f1c63dc284d0d70e8c72f563ffa5c7bf0fb8` |
| 新 AerodromeAdapter | `0xe02a1a6cb019a35Ff7ED04F0cb36449a8c768e23` |
| VVVPayout | `0xc9102200271245660AB1C640CEB502936BDe04E1`（不变） |
| VVVTreasury | `0xA223C9e22532a7d985004fe3714AB3D873F4c3a2`（不变） |
| VVVEcoStaking | `0xc451DdCdDbd9e8700E71960d190b55fE1eD57B34`（不变） |
| Payout.setRouter | ✅ 已更新至新 Adapter |
| Treasury.setRouter | ✅ 已更新至新 Adapter |
| 部署脚本 | `scripts/redeploy-adapter.ts` |

### 验证结果（部署前 staticCall）

| 验证项 | 结果 |
|---|---|
| `getAmountsIn(0.009 VVV)` | 返回 83,144,240,890,813 wei ≈ 0.0000831 ETH，不 revert |
| `swapExactETHForTokens` staticCall | ✅ 成功，VVV out = 0.009，amountOutMin 满足 |
| Pool reserves | WETH 2614 / VVV 283826，fee = 30bps |
| getAmountsOut 交叉验证 | 误差 0.0000%，完全精确 |

---

## 2026-06-15 — AerodromeAdapter v3：fee swap 修复（1% buffer）

### 问题描述

用户 VVV 已到账，但 FeeWallet（`0xb32134...`）始终未收到手续费 VVV。
链上每笔 RewardPaid tx 同时出现 `PayoutQueued(user, 0, feeVvv, "fee swap failed")`，
`pendingFeeForUser[user]` 持续累积（累计 ~0.00248536 VVV）。

### 根本原因

`_tryExecute` 在同一笔 tx 内连续执行两次 swap：
1. **net swap**：`getAmountsIn(netVvv)` → `ethForNet`（按原始 reserves 计算） → swap 成功 → pool reserves 改变
2. **fee swap**：`getAmountsIn(feeVvv)` → `ethForFee`（也按原始 reserves 计算）→ 但此时 pool reserves 已被 net swap 改变

Net swap 消耗了池中少量 VVV，导致 fee swap 时 `swapExactETHForTokens` 的实际输出：

```
feeVvvActual = 151,828,702,239,645 wei
FEE_VVV min  = 151,828,703,703,703 wei
shortfall    = 1,464,058 wei  ← amountOutMin 检查失败
```

fee swap revert → catch → `pendingFeeForUser += feeVvv` → "fee swap failed"

### 修复方案

`AerodromeAdapter.getAmountsIn` 加 1% buffer，覆盖 net swap 造成的 reserve 偏移：

```solidity
uint256 base = numerator / denominator + 1;
amounts[0] = base + (base / 100); // +1% buffer
```

效果验证：
- net swap 后，fee swap 实际输出 = 0.0001533470 VVV ≥ FEE_VVV 0.0001518287 VVV ✅
- 每笔 claim 额外消耗 ETH < 0.00000083 ETH ≈ 可忽略
- 多余 ETH 全部转化为 VVV（用户及 feeWallet 各自略多收 ~1%）

### 部署记录

| 项目 | 值 |
|---|---|
| 新 AerodromeAdapter v3 | `0x0EBa8c690a11bc1F1B7Db909E7D0748d770F1ac6` |
| Payout.setRouter | ✅ 已更新 |
| Treasury.setRouter | ✅ 已更新 |

---

### 上线确认

- 首笔真实领取 tx：`0x4eed10fa4704b3493220c07ad6f3d2a008433b947a0eef7c19d844bb00d89bc8`（此 tx 仍为旧 adapter，"swap failed"）
- 新 adapter 上线后用户领取：✅ `RewardPaid` 事件触发，VVV 直接到账

### 待办

- [ ] Payout 补充 ETH（当前余额 ~0.07 ETH，建议 ≥ 0.5 ETH）：
  ```bash
  cast send 0xc9102200271245660AB1C640CEB502936BDe04E1 \
    "depositETH()" --value 0.5ether \
    --private-key $PRIVATE_KEY --rpc-url https://mainnet.base.org
  ```
