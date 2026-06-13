# VVVEco Beta Testnet Stable

**版本标签：** `beta-testnet-stable`
**发布日期：** 2026-06-13
**网络：** Base Sepolia (chainId: 84532)

---

## 合约地址

| 合约 | 地址 |
|------|------|
| VVVToken | `0x3C03096D6174b7d6Cc6d5f1e442f43B269Bc3A30` |
| MockRouter | `0x9BB5BA22C26B816157Cd943b13bEe8967aAe01B1` |
| VVVTreasury | `0xD9247b65A641c67b4Db600494af67E0De6e17e72` |
| VVVPayout | `0x6cb514724C355Be8A2d19D1228DF8300cBb1CbA6` |
| VVVEcoStaking | `0x707AeF5E4331c45F1b11aA50EB452b396cE69DD9` |

---

## Git 信息

| 项目 | 值 |
|------|----|
| 仓库 | https://github.com/JH666666/VVVEco |
| 分支 | `main` |
| Commit | `ad5f555` |
| Tag | `beta-testnet-stable` |

---

## 关键配置

```env
NEXT_PUBLIC_VVV_TOKEN=0x3C03096D6174b7d6Cc6d5f1e442f43B269Bc3A30
NEXT_PUBLIC_VVECO_STAKING=0x707AeF5E4331c45F1b11aA50EB452b396cE69DD9
NEXT_PUBLIC_VVECO_PAYOUT=0x6cb514724C355Be8A2d19D1228DF8300cBb1CbA6
NEXT_PUBLIC_VVECO_TREASURY=0xD9247b65A641c67b4Db600494af67E0De6e17e72
NEXT_PUBLIC_MOCK_ROUTER=0x9BB5BA22C26B816157Cd943b13bEe8967aAe01B1
NEXT_PUBLIC_ADMIN_OWNER_ADDRESS=0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3
NEXT_PUBLIC_ROOT_REFERRER_ADDRESS=0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3
```

---

## 验收功能清单

| 功能 | 状态 |
|------|------|
| 质押（币本位 / 金本位） | ✓ 通过 |
| 邀请绑定 | ✓ 通过 |
| 邀请奖励 | ✓ 通过 |
| 团队奖励（代际 / 平级 / 级差） | ✓ 通过 |
| 收益领取（与赎回分离） | ✓ 通过 |
| 到期赎回本金 | ✓ 通过 |
| 动态等级升降 | ✓ 通过 |
| 赎回后订单状态同步 | ✓ 通过 |
| 资产看板统计（质押 / 赎回金额） | ✓ 通过 |

---

## 合约核心逻辑说明

### 奖励模式
- **币本位（isCoinBased=true）**：以 VVV 计价，`reward = vvvAmountIn × rate × elapsed / (1000 × 86400)`，赎回返还原始 VVV
- **金本位（isCoinBased=false）**：以 USD 计价，`reward = usdValue × rate × elapsed / (1000 × 86400)`，赎回按实时价格换算 VVV

### 赎回规则
- 必须先领完全部收益，才能赎回本金（`claimedAmount >= totalAccrued`）
- 赎回触发上游 7 层 `teamVolume7` 递减，并动态重算等级

### 等级规则
- V1 门槛 = $0（最低等级为 V1，不会降至 V0）
- 等级随团队质押量实时升降（`_updateLevel`）

### 团队奖励规则
- Rule1（级差）：上级等级 > 直接父级等级时补差额
- Rule2（平级）：直接父级等级 ≤ 触发者等级时固定 10%
- Rule3：不触发（= 0）

---

## 注意事项

- 本版本使用 MockRouter 模拟价格，`mockPrice = 0.2 USD/VVV`
- `setOrderEndTime` 测试函数已从正式版合约中移除
- `.env.local` 不纳入 git 版本控制，需在部署环境中单独配置
