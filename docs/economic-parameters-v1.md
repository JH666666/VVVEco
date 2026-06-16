# VVVEco Mainnet V1 Economic Parameters

> 版本：V1  
> 状态：**待上链执行**  
> 制定日期：2026-06-16  
> 依据：VVVEcoStaking.sol 合约源码实际逻辑推导

---

## 参数方案

### 邀请奖励 `inviteRates`

| 代数 | 参数索引 | 奖励比例 |
|------|----------|---------|
| 1 代（直属） | `inviteRates[1]` | **10%** |
| 2 代 | `inviteRates[2]` | **5%** |
| 3 代 | `inviteRates[3]` | **3%** |

邀请奖励最多 3 代，无压缩（不检查是否有活跃订单），通过 `payPrincipal` 支付，**不收手续费**。

### 等级系数 `levelRates`

| 等级 | 参数索引 | 系数（级差奖励基准） |
|------|----------|---------------------|
| V1 | `levelRates[1]` | **3%** |
| V2 | `levelRates[2]` | **4%** |
| V3 | `levelRates[3]` | **5%** |
| V4 | `levelRates[4]` | **6%** |
| V5 | `levelRates[5]` | **7%** |
| V6 | `levelRates[6]` | **8%** |
| V7 | `levelRates[7]` | **9%** |
| V8 | `levelRates[8]` | **10%** |

级差奖励公式（合约 `sol:534-536`）：
```
bonus = vvvGross × (levelRates[upLevel] − levelRates[clLevel]) / 100
```
其中 `clLevel = max(1, users[claimer].level)`，最多向上 7 层有效上级（有活跃订单）。

### 平级奖励（合约硬编码）

直属上级等级 ≤ 领取人等级时，触发 **10% 平级奖励**（`sol:537-539`），通过 `payPrincipal` 支付，**不收手续费**。此值写死在合约中，无 setter，不可通过链上调用修改。

### 手续费

`feePercent = 10`（VVVPayout.sol:43），仅对用户个人领取（`payReward`）扣取，上级团队奖励不收手续费。

---

## 最大拨比验证

基于合约 `_propagateRewards`（`sol:488-549`）精确模拟，领取人领取 100 VVV：

### 场景 A：领取人 V1，上级 1-7 全部 V8（正常极端结构）

| 来源 | 计算 | 金额 |
|------|------|------|
| 邀请奖励 3 代 | 10+5+3 | 18 VVV |
| 级差奖励 × 7（Rule 1） | 7 × (10−3)% × 100 | 49 VVV |
| 用户实际到账 | 100 × 90% | 90 VVV |
| feeWallet 手续费 | 100 × 10% | 10 VVV |
| **系统总拨出** | | **167 VVV** |

**总拨比：167%**

### 场景 B：领取人 V1，直属上级 V1（触发 Rule 2），上级 2-7 为 V8（理论极端）

| 来源 | 计算 | 金额 |
|------|------|------|
| 邀请奖励 3 代 | 10+5+3 | 18 VVV |
| 直属上级 Rule 2 平级 | 10% × 100 | 10 VVV |
| 级差奖励 × 6（Rule 1） | 6 × (10−3)% × 100 | 42 VVV |
| 用户实际到账 | 100 × 90% | 90 VVV |
| feeWallet 手续费 | 100 × 10% | 10 VVV |
| **系统总拨出** | | **170 VVV** |

**总拨比：170%**

> Rule 2 边界说明：当直属上级等级 ≤ 领取人等级时，平级奖励固定 10%（硬编码）。在本参数方案下，V8-V1 级差仅 7%，低于平级 10%，导致 V1 直属上级比 V8 直属上级多拿 3%。该场景为极端异常结构，正常用户不会出现直属上级低于自身等级的情况。

### 最大拨比汇总

| 场景 | 总拨比 |
|------|--------|
| 正常极端（全 V8 上级） | **167%** |
| 理论极端（V1 直属 + V8 其余） | **170%** |

---

## 上链执行命令

```bash
STAKING=0xc451DdCdDbd9e8700E71960d190b55fE1eD57B34
RPC=https://mainnet.base.org

# 邀请奖励
cast send $STAKING "setInviteRate(uint256,uint256)" 1 10 --private-key $PRIVATE_KEY --rpc-url $RPC
cast send $STAKING "setInviteRate(uint256,uint256)" 2 5  --private-key $PRIVATE_KEY --rpc-url $RPC
cast send $STAKING "setInviteRate(uint256,uint256)" 3 3  --private-key $PRIVATE_KEY --rpc-url $RPC

# 等级系数
cast send $STAKING "setLevelRate(uint8,uint256)" 1 3  --private-key $PRIVATE_KEY --rpc-url $RPC
cast send $STAKING "setLevelRate(uint8,uint256)" 2 4  --private-key $PRIVATE_KEY --rpc-url $RPC
cast send $STAKING "setLevelRate(uint8,uint256)" 3 5  --private-key $PRIVATE_KEY --rpc-url $RPC
cast send $STAKING "setLevelRate(uint8,uint256)" 4 6  --private-key $PRIVATE_KEY --rpc-url $RPC
cast send $STAKING "setLevelRate(uint8,uint256)" 5 7  --private-key $PRIVATE_KEY --rpc-url $RPC
cast send $STAKING "setLevelRate(uint8,uint256)" 6 8  --private-key $PRIVATE_KEY --rpc-url $RPC
cast send $STAKING "setLevelRate(uint8,uint256)" 7 9  --private-key $PRIVATE_KEY --rpc-url $RPC
cast send $STAKING "setLevelRate(uint8,uint256)" 8 10 --private-key $PRIVATE_KEY --rpc-url $RPC
```

---

## 与原始参数对比

| 参数 | 原始值 | V1 方案 | 变化 |
|------|--------|---------|------|
| inviteRates gen1 | 15% | 10% | −5% |
| inviteRates gen2 | 10% | 5% | −5% |
| inviteRates gen3 | 5% | 3% | −2% |
| levelRates V8 | 80% | 10% | −70% |
| 最大总拨比 | 620% | 167-170% | **−450%** |
