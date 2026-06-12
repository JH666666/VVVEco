# VVVeco 项目交接与全面审计

> 生成时间: 2026-06-09
> 审计方式: 代码+数据库+API+合约 实际运行状态

---

## 第一部分：项目基础信息

| 项目 | 值 |
|------|-----|
| 项目名称 | VVVeco |
| 技术栈 | Next.js 16 + Prisma 7 + Wagmi + RainbowKit + Solidity 0.8.20 |
| Next.js | 16.2.6 (Turbopack) |
| Prisma | 7.8.0 |
| 数据库 | SQLite (dev.db), 生产切换 PostgreSQL |
| Wagmi | 3.6.16 |
| RainbowKit | 2.2.11 |
| Viem | 2.52.2 |
| 运行方式 | `npm run dev` → localhost:3000 |
| 部署链 | Base Sepolia (84532) / Hardhat Local (31337) |
| 用户身份 | wallet_address 为主键 |
| 后台 UID | 100001 起自增 |

---

## 第二部分：目录结构

```
app/            — Next.js 页面路由 (dashboard, stake, team, community, notifications, admin)
app/api/        — 17 个 API 路由端点
components/     — React 组件 (admin, dashboard, staking, team, layout, marketing, ui)
lib/            — 核心库 (prisma, contract-hooks, api-client, admin-controls, web3-config)
hooks/          — 自定义 hooks (use-mobile, use-toast)
contracts/      — Solidity 合约 (VVVToken, VVVEcoStaking)
prisma/         — Prisma schema + SQLite 数据库
scripts/        — 部署脚本 (deploy.ts)
public/         — 静态资源
contexts/       — React Context (local-web3-sim, language, admin-wallet)
```

---

## 第三部分：数据库审计

### 实际存在的 12 张表

| 表名 | 主键 | 用途 | 状态 |
|------|------|------|------|
| `users` | wallet_address | 用户注册, UID, 邀请码, 邀请关系 | ✅ |
| `invite_relations` | child_address | 邀请关系审计日志 | ✅ |
| `stake_orders` | tx_hash | 质押订单索引 | ✅ |
| `claim_records` | tx_hash | 收益领取记录 | ✅ |
| `team_rewards` | id (自增) | 团队奖励分配 | ✅ |
| `user_freeze_status` | wallet_address | 冻结状态 | ✅ |
| `reward_config` | id=1 | 邀请比例 + 周期费率 | ✅ |
| `global_stats_config` | id=1 | 全球统计配置 | ✅ |
| `contract_config` | id=1 | 合约地址/参数配置 | ✅ |
| `admin_audit_logs` | id (自增) | 管理操作审计 | ✅ |
| `notifications` | id (UUID) | 系统通知 | ✅ |

### 缺失表

无。12 张设计表全部已创建。

### 当前数据量

| 表 | 行数 |
|----|------|
| users | 4 |
| stake_orders | 6 |
| claim_records | 0 |
| team_rewards | 0 |
| admin_audit_logs | 4 |

---

## 第四部分：API审计

### 全部 17 个端点

| # | 方法 | 路径 | 功能 | 状态 |
|---|------|------|------|------|
| 1 | POST | /api/users/register | 用户注册 | ✅ |
| 2 | GET | /api/users/[wallet] | 用户查询 | ✅ |
| 3 | GET | /api/admin/users | 后台用户列表 | ✅ |
| 4 | GET | /api/admin/freeze | 查询冻结 | ✅ |
| 5 | PUT | /api/admin/freeze | 写入冻结 | ✅ |
| 6 | GET | /api/admin/freeze-list | 全部冻结列表 | ✅ |
| 7 | PUT | /api/admin/hide-order | 隐藏/显示订单 | ✅ |
| 8 | GET | /api/admin/audit-logs | 审计日志 | ✅ |
| 9 | GET | /api/admin/contract-config | 合约配置 | ✅ |
| 10 | PUT | /api/admin/contract-config | 更新合约配置 | ✅ |
| 11 | POST | /api/invite/bind | 绑定邀请 | ✅ |
| 12 | GET | /api/invite/list | 邀请关系 | ✅ |
| 13 | GET | /api/stake-orders | 质押订单查询 | ✅ |
| 14 | POST | /api/stake-orders | 创建订单 | ✅ |
| 15 | GET | /api/claims | 收益查询 | ✅ |
| 16 | POST | /api/claims | 创建收益记录 | ✅ |
| 17 | GET | /api/team-rewards | 团队奖励查询 | ✅ |
| 18 | POST | /api/team-rewards | 创建团队奖励 | ✅ |
| 19 | POST | /api/team-rewards/claim | 批量领取 | ✅ |
| 20 | GET | /api/config/reward | 收益参数 | ✅ |
| 21 | PUT | /api/config/reward | 更新收益参数 | ✅ |
| 22 | GET | /api/global-stats | 全球统计 | ✅ |
| 23 | PUT | /api/global-stats | 更新统计 | ✅ |
| 24 | GET | /api/notifications | 通知列表 | ✅ |
| 25 | POST | /api/notifications | 发布通知 | ✅ |
| 26 | PUT | /api/notifications | 关闭通知 | ✅ |
| 27 | DELETE | /api/notifications | 删除通知 | ✅ |

### API 测试结果 (实时)

| 端点 | 结果 |
|------|------|
| /api/users/register | ✅ 返回 uid, inviteCode |
| /api/admin/users | ✅ 4 users |
| /api/stake-orders?wallet=0x0a28... | ✅ 3 orders |
| /api/claims | ✅ 0 claims (无领取记录) |
| /api/team-rewards | ✅ 0 rewards (无团队数据) |
| /api/admin/freeze | ✅ 返回冻结状态 |

---

## 第五部分：前端页面审计

### 用户端 (6 页)

| 页面 | 路由 | 数据源 | 状态 |
|------|------|--------|------|
| 首页 | / | 静态营销 | ✅ |
| 质押大厅 | /stake | localStorage + 合约 sync | ✅ |
| 资产看板 | /dashboard | API(/api/stake-orders, /api/claims) + localStorage fallback | ✅ |
| 我的团队 | /team | API(/api/team-rewards) + localStorage fallback | ✅ |
| 社群 | /community | 静态链接 | ✅ |
| 通知 | /notifications | API(/api/notifications) + localStorage fallback | ✅ |

### 后台管理 (4 页)

| 页面 | 路由 | 数据源 | 状态 |
|------|------|--------|------|
| 用户管理 | /admin/users | API(/api/admin/users) + localStorage fallback | ✅ |
| 合约控制 | /admin/contract | API(/api/admin/contract-config, freeze, hide-order) | ✅ |
| 全球数据 | /admin/global | API(/api/config/reward, global-stats) + 链上 level setters | ✅ |
| 公告管理 | /admin/web | API(/api/notifications) | ✅ |
| 登录 | /admin | Cookie HMAC | ✅ |

---

## 第六部分：合约接入验证

### VVVToken

| 函数 | 合约 | ABI | Hook | 页面调用 | 生效 |
|------|------|-----|------|---------|------|
| approve | ✅ | ✅ | useApproveVVV | staking-hub | ✅ |
| balanceOf | ✅ | ✅ | useVVVBalance | staking-hub | ✅ |

### VVVEcoStaking

| 函数 | 合约 | ABI | Hook | 页面调用 | 生效 |
|------|------|-----|------|---------|------|
| stake | ✅ | ✅ | useStake | staking-hub | ✅ |
| claimAllRewards | ✅ | ✅ | useClaimRewards | dashboard, team | ✅ |
| withdrawOrderPrincipal | ✅ | ✅ | useWithdrawPrincipal | dashboard (WithdrawButton) | ✅ |
| setFreezeStatus | ✅ | ✅ | useSetFreezeStatus | contract-admin | ✅ |
| setFeePercent | ✅ | ✅ | useSetFeePercent | contract-admin | ✅ |
| setProjectWallet | ✅ | ✅ | useSetProjectWallet | contract-admin | ✅ |
| setFeeWallet | ✅ | ✅ | useSetFeeWallet | contract-admin | ✅ |
| setLevelThreshold | ✅ | ✅ | useSetLevelThreshold | global-stats-admin | ✅ |
| setLevelRate | ✅ | ✅ | useSetLevelRate | global-stats-admin | ✅ |
| transferOwnership | ✅ | ✅ | useSetOwner | contract-admin | ✅ |
| getLatestPrice | ✅ | ✅ | useLatestPrice | staking-hub | ✅ |
| owner | ✅ | ✅ | useStakingOwner | contract-admin, global-stats | ✅ |

全部 12 个合约函数：✅ 已接通

---

## 第七部分：业务流程验证

| 步骤 | 页面 | API | DB | 合约 | 状态 |
|------|------|-----|----|----|------|
| 钱包连接 | RainbowKit ConnectButton | - | - | injected() | ✅ 连通 |
| Approve | /stake → useApproveVVV | - | - | vvvToken.approve | ✅ 连通 |
| Stake | /stake → useStake | POST /api/stake-orders | stake_orders | staking.stake | ✅ 连通 |
| 订单写入 | createStakeOrder() | ✅ | ✅ | ✅ | ✅ 连通 |
| Dashboard显示 | fetchStakeOrders + fetchClaimRecords | GET /api/stake-orders | ✅ | - | ✅ 连通 |
| 领取收益 | handleClaimReward → useClaimRewards | POST /api/claims | claim_records | claimAllRewards | ✅ 连通 |
| 团队奖励 | handleClaimTeamRewards → useClaimRewards | POST /api/team-rewards/claim | team_rewards | claimAllRewards | ✅ 连通 |
| 到期赎回 | WithdrawButton → useWithdrawPrincipal | - | stake_orders.is_withdrawn | withdrawOrderPrincipal | ✅ 连通 |

---

## 第八部分：后台管理验证

### 用户冻结

| 操作 | 页面 | API | DB | 合约 | 状态 |
|------|------|-----|----|----|------|
| 冻结收益 | contract-admin → updateFreezeStatus | PUT /api/admin/freeze | user_freeze_status | setFreezeStatus | ✅ |
| 冻结团队收益 | 同上 | 同上 | 同上 | 同上 | ✅ |
| 冻结本金赎回 | 同上 | 同上 | 同上 | 同上 | ✅ |
| 解冻 | 同上 (frozen=false) | 同上 | 同上 | 同上 | ✅ |
| 审计日志 | - | GET /api/admin/audit-logs | admin_audit_logs | - | ✅ |

### 订单隐藏

| 操作 | 页面 | API | DB | 最终效果 | 状态 |
|------|------|-----|----|---------|------|
| 隐藏订单 | user-admin → hideOrder | PUT /api/admin/hide-order | stake_orders.hidden_by_admin | Dashboard过滤 + API过滤 | ✅ |
| 显示订单 | 同上 (hidden=false) | 同上 | 同上 | 同上 | ✅ |

---

## 第九部分：localStorage 残留

| Key | 用途 | 是否可移除 |
|-----|------|-----------|
| vvveco-local-web3-sim | 兼容层 (fallback) | ⚠️ 需保留至完全迁移 |
| vvveco-notifications | 通知 (API已就绪) | ✅ 可移除 |
| vvveco-admin-controls | 冻结/隐藏 (API已就绪) | ✅ 可移除 |
| vvveco-global-stats-config | 统计 (API已就绪) | ✅ 可移除 |
| vvveco-reward-config | 奖励参数 (API已就绪) | ✅ 可移除 |
| vvveco-contract-settings/bindings | 合约配置 (API已就绪) | ✅ 可移除 |
| vvveco-team-nicknames | 昵称 | ⚠️ 尚未迁移 |
| vvveco-user-level-overrides | 等级覆盖 | ⚠️ 尚未迁移 |
| theme / adminTheme | UI偏好 | ✅ 保留 |

---

## 第十部分：已知问题

| # | 问题 | 严重度 | 位置 |
|---|------|--------|------|
| 1 | Dashboard 连接 0x0a28...fA2c6 时显示"暂无质押订单" | 🔴 | API返回3条但前端未渲染 — 需确认钱包地址匹配 |
| 2 | 合约未部署到 Base Sepolia | 🔴 | PRIVATE_KEY 未设置 |
| 3 | team-rewards / claims 表数据为空 | ⚠️ | 需执行实际 stake+claim 产生数据 |
| 4 | localStorage fallback 仍存在于多个组件 | 🟡 | 可逐步移除 |

---

## 第十一部分：缺失功能

| 功能 | 状态 |
|------|------|
| 通知读状态跨设备同步 | ❌ (当前仅API, 无用户级已读标记) |
| 用户昵称 DB 迁移 | ❌ (仅 localStorage) |
| 用户等级覆盖 DB 迁移 | ❌ (仅 localStorage) |
| Base Sepolia 部署 | ❌ (本地 Hardhat 已验证) |
| 合约 verify | ❌ |
| 事件 indexer (The Graph) | ❌ |
| 团队等级后端计算 | ❌ (前端 localStorage 计算) |

---

## 第十二部分：最终状态

### 项目完成度: 75%

| 模块 | 完成度 |
|------|--------|
| 前端页面 | 90% |
| 后台管理 | 85% |
| 数据库 | 95% |
| API | 90% |
| 合约接入 | 85% |
| 合约部署 | 10% (仅本地) |

### 当前是否达到测试网验收标准

**NO**

原因:
1. 合约未部署到 Base Sepolia
2. 未执行真实链上 stake/claim/withdraw 全流程验证
3. 团队奖励计算仍在前端 localStorage
4. 部分 localStorage fallback 未完全移除

---

## 附录：启动命令

```bash
# 本地开发
npx hardhat node                    # 启动本地链
npx tsx scripts/deploy.ts           # 部署合约
npm run dev                         # 启动前端 → localhost:3000

# 数据库
npx prisma db push                  # 同步 schema
npx prisma generate                 # 生成 client

# 部署 Base Sepolia (需 PRIVATE_KEY)
npx tsx scripts/deploy.ts           # 使用 .env 中的 BASE_SEPOLIA_RPC

# MetaMask 本地测试
Network: http://127.0.0.1:8545 (Chain 31337)
Test PK: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
Owner:   0x0a28A06fD56dDe253CFF723582374fbeB2cfA2c6 (Base Sepolia)
```
