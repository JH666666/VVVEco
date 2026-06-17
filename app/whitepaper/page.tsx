import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export const metadata = {
  title: 'VVVEco 白皮书 — 去中心化质押协议',
  description: 'VVVEco 官方技术白皮书，涵盖代币经济学、智能合约架构、质押机制与团队奖励分配。',
}

const TOC = [
  { id: 'abstract',      label: '摘要' },
  { id: 'introduction',  label: '一、项目介绍' },
  { id: 'token',         label: '二、代币经济学' },
  { id: 'architecture',  label: '三、技术架构' },
  { id: 'staking',       label: '四、质押机制' },
  { id: 'rewards',       label: '五、奖励分配' },
  { id: 'security',      label: '六、安全机制' },
  { id: 'roadmap',       label: '七、路线图' },
  { id: 'contracts',     label: '八、合约地址' },
]

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 顶栏 */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回应用
          </Link>
          <span className="text-sm font-semibold tracking-wide text-primary">VVVEco</span>
          <a
            href="https://github.com/jh666666/vvveco"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:flex lg:gap-12 lg:py-16">
        {/* 目录侧边栏 — 仅桌面端显示 */}
        <aside className="hidden lg:block lg:w-52 lg:shrink-0">
          <div className="sticky top-24">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">目录</p>
            <nav className="space-y-1">
              {TOC.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block rounded px-2 py-1 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* 正文 */}
        <article className="min-w-0 flex-1 space-y-12">

          {/* 封面 */}
          <div className="space-y-4 border-b border-border pb-10">
            <div className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              技术白皮书 · v1.0
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">VVVEco Protocol</h1>
            <p className="text-xl text-muted-foreground">
              基于 Base 主网的去中心化双模式质押平台
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>发布时间：2026 年 6 月</span>
              <span>·</span>
              <span>网络：Base Mainnet（Chain ID: 8453）</span>
              <span>·</span>
              <span>Solidity ^0.8.20</span>
            </div>
          </div>

          {/* 摘要 */}
          <Section id="abstract" title="摘要">
            <p>
              VVVEco 是一个构建于 Base L2 网络的非托管链上质押协议，
              创新性地引入了<strong>双模式质押模型</strong>——用户可在同一合约体系内自由选择
              <strong>币本位</strong>（以 VVV 计价）或<strong>法币本位</strong>（以 USD 计价）两种收益模式。
              协议内置多层推荐树，在每次收益领取时自动完成邀请奖励与团队奖励的链上分配，
              无需中心化结算层即可形成自我驱动的增长闭环。
            </p>
            <p>
              协议将职责分离至四个独立合约——质押核心、代币、国库、出款——最小化攻击面，
              并支持对每个组件进行独立安全审计。
            </p>
          </Section>

          {/* 项目介绍 */}
          <Section id="introduction" title="一、项目介绍">
            <SubSection title="1.1 问题背景">
              <p>
                现有质押协议通常将用户锁定在单一计价体系中。当代币价格波动时，
                质押者须独自承担全部币价风险，缺乏有效对冲手段。
                与此同时，推荐奖励机制普遍不透明，依赖链下人工结算，易被操控。
              </p>
            </SubSection>
            <SubSection title="1.2 解决方案">
              <p>VVVEco 通过以下三点解决上述问题：</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>双模式质押</strong> —— 币本位锁定 VVV 数量；
                  法币本位锁定入场时的 USD 等值，到期按当前价格兑回 VVV，
                  实现链上稳定价值语义。
                </li>
                <li>
                  <strong>全链上推荐树</strong> —— 邀请奖励（3 代）与团队奖励（7 代压缩）
                  在每次领取时原子完成计算与支付，无链下结算环节。
                </li>
                <li>
                  <strong>完全自托管</strong> —— 质押资金直接流入项目国库钱包，
                  协议合约本身不持有用户本金。
                </li>
              </ul>
            </SubSection>
          </Section>

          {/* 代币经济学 */}
          <Section id="token" title="二、代币经济学">
            <SubSection title="2.1 VVV 代币">
              <p>
                协议原生功能代币为 <strong>VVV</strong>，是部署于 Base 主网的标准 ERC-20 代币，
                贯穿协议质押媒介、奖励货币与手续费计价全流程。
              </p>
              <Table
                headers={['属性', '值']}
                rows={[
                  ['标准', 'ERC-20（OpenZeppelin 5.x）'],
                  ['网络', 'Base Mainnet（L2 on Ethereum）'],
                  ['精度', '18 位小数'],
                  ['增发权限', 'Owner 控制'],
                ]}
              />
            </SubSection>
            <SubSection title="2.2 手续费结构">
              <p>
                个人收益领取时扣除可配置的协议手续费（默认 <strong>10%</strong>），
                路由至专属手续费钱包。本金赎回及团队/邀请奖励<strong>不收取手续费</strong>。
              </p>
            </SubSection>
            <SubSection title="2.3 资金流转">
              <CodeBlock>{`质押：  用户 VVV ──transferFrom──▶ Treasury ──swap──▶ ETH ──▶ 项目钱包
领取：  Payout ETH ──swap──▶ VVV ──▶ 手续费钱包 (10%) + 用户 (净额)
提现：  Payout ETH ──swap──▶ VVV ──▶ 用户 (全额本金，不收手续费)`}</CodeBlock>
            </SubSection>
          </Section>

          {/* 技术架构 */}
          <Section id="architecture" title="三、技术架构">
            <SubSection title="3.1 合约套件">
              <p>协议由四个 Solidity 合约组成：</p>
              <Table
                headers={['合约', '职责']}
                rows={[
                  ['VVVToken', 'ERC-20 功能代币'],
                  ['VVVEcoStaking', '核心逻辑：订单管理、收益计算、推荐树、等级体系'],
                  ['VVVTreasury', '接收质押 VVV，兑换为 ETH，转发至项目钱包'],
                  ['VVVPayout', '持有 ETH 储备，按需兑换为 VVV，向用户及上线支付'],
                ]}
              />
            </SubSection>
            <SubSection title="3.2 Web 应用技术栈">
              <Table
                headers={['层级', '技术']}
                rows={[
                  ['前端', 'Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS 4'],
                  ['Web3', 'Wagmi 3 · RainbowKit 2 · Viem 2 · ethers.js 6'],
                  ['数据库', 'Prisma 7 · SQLite'],
                  ['后台', 'HMAC-SHA-256 会话认证 · Next.js API Routes'],
                  ['合约', 'Hardhat 3 · OpenZeppelin 5 · Solidity 0.8.20'],
                ]}
              />
            </SubSection>
            <SubSection title="3.3 价格预言机">
              <p>
                法币模式的换算使用链上 Swap Router（Uniswap V3 接口）实时获取 VVV/ETH 价格，
                确保入场与赎回的 USD 等值计算均基于链上可验证数据。
              </p>
            </SubSection>
          </Section>

          {/* 质押机制 */}
          <Section id="staking" title="四、质押机制">
            <SubSection title="4.1 订单模型">
              <p>每个质押仓位以链上 <code>Order</code> 结构存储，包含以下字段：</p>
              <Table
                headers={['字段', '说明']}
                rows={[
                  ['vvvAmountIn', '原始质押 VVV 数量'],
                  ['usdValue', '入场时 USD 等值（18 位精度）'],
                  ['startTime / endTime', '锁仓开始与结束的 UNIX 时间戳'],
                  ['duration', '锁仓周期（天）'],
                  ['rate', '千分比日化收益率（如 7 = 0.7%/天）'],
                  ['isCoinBased', 'true = 币本位，false = 法币本位'],
                  ['isWithdrawn', '本金是否已赎回'],
                  ['claimedAmount', '累计已支付收益'],
                ]}
              />
            </SubSection>
            <SubSection title="4.2 币本位模式">
              <CodeBlock>{`收益 (VVV) = vvvAmountIn × rate × 已过时间(秒)
            ÷ (1000 × 86400)
赎回       = 原始 vvvAmountIn`}</CodeBlock>
              <p>
                收益随 VVV 持仓量线性增长，适合对 VVV 代币长期看涨的用户。
              </p>
            </SubSection>
            <SubSection title="4.3 法币本位模式">
              <CodeBlock>{`收益 (USD) = usdValue × rate × 已过时间(秒)
           ÷ (1000 × 86400)
           → 按当前价格换算为 VVV
赎回 (VVV) = usdValue × 1e18 ÷ 当前价格`}</CodeBlock>
              <p>
                美元锚定机制保护本金价值不受代币贬值影响；赎回金额按到期时的实时价格换算，
                确保用户无论市场涨跌均能取回等值 USD。
              </p>
            </SubSection>
            <SubSection title="4.4 质押周期与收益率">
              <Table
                headers={['周期', '日化收益率']}
                rows={[
                  ['1 天', '0.7%'],
                  ['15 天', '0.8%'],
                  ['30 天', '0.9%'],
                  ['60 天', '1.0%'],
                ]}
              />
            </SubSection>
          </Section>

          {/* 奖励分配 */}
          <Section id="rewards" title="五、奖励分配">
            <SubSection title="5.1 邀请奖励（3 代）">
              <p>
                用户每次领取个人收益时，系统沿推荐树向上追溯三代并立即分发邀请奖励：
              </p>
              <Table
                headers={['代际', '奖励比例']}
                rows={[
                  ['第 1 代（直接推荐人）', '领取人总收益的 10%'],
                  ['第 2 代', '领取人总收益的 5%'],
                  ['第 3 代', '领取人总收益的 3%'],
                ]}
              />
            </SubSection>
            <SubSection title="5.2 团队奖励（7 代压缩）">
              <p>
                在邀请奖励之外，基于等级的团队奖励向上传递至多 7 个<em>有效</em>祖先节点
                （有效 = 持有至少一个未到期且未提现的订单）。
                协议采用差值压缩机制避免重复支付：
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  若祖先等级<strong>高于</strong>领取人等级，获得<em>差额奖励</em>：
                  <code>（levelRates[上级] − levelRates[领取人]）% × 总收益</code>
                </li>
                <li>
                  若<strong>直接上级</strong>等级等于或低于领取人，获得固定 <strong>10%</strong> 同级奖励。
                </li>
                <li>
                  间接祖先且等级不高于领取人，则不获得奖励。
                </li>
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">
                所有奖励通过 <code>VVVPayout.payPrincipal</code> 免手续费即时发放。
                若 Payout ETH 储备不足，支付进入队列，待储备恢复后自动清算。
              </p>
            </SubSection>
            <SubSection title="5.3 等级体系">
              <p>
                用户等级由个人累计质押量决定，合约 Owner 可通过
                <code>setLevelThreshold</code> 与 <code>setLevelRate</code>
                动态调整各级门槛与奖励比例，无需重新部署合约。
              </p>
            </SubSection>
          </Section>

          {/* 安全机制 */}
          <Section id="security" title="六、安全机制">
            <SubSection title="6.1 合约层安全">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>ReentrancyGuard</strong>（OpenZeppelin）——所有改变状态的外部函数均防重入保护。
                </li>
                <li>
                  <strong>Pausable</strong> —— Owner 可在紧急情况下一键暂停全部操作。
                </li>
                <li>
                  <strong>Ownable</strong> + <code>transferOwnership</code> —— 支持管理员密钥轮换，无需重新部署。
                </li>
                <li>
                  <strong>非托管设计</strong> —— 质押合约不持有用户资金，所有代币托管隔离于 Treasury 与 Payout 合约。
                </li>
              </ul>
            </SubSection>
            <SubSection title="6.2 后台管理安全">
              <ul className="list-disc pl-5 space-y-1">
                <li>HMAC-SHA-256 签名 Cookie 会话，8 小时无操作自动退出。</li>
                <li>所有管理操作写入不可篡改的审计日志表。</li>
                <li>后台 UI 强制验证 Base Mainnet 链 ID，防止误操作。</li>
              </ul>
            </SubSection>
            <SubSection title="6.3 审计计划">
              <p>
                四个核心合约的独立第三方安全审计将在正式全量开放前完成。
              </p>
            </SubSection>
          </Section>

          {/* 路线图 */}
          <Section id="roadmap" title="七、路线图">
            <div className="space-y-4">
              {[
                {
                  phase: '阶段一 · 测试网',
                  status: '已完成',
                  items: ['Base Sepolia 合约部署', '质押 / 领取 / 提现全流程验证', '后台管理系统（6 大模块）', '双模式质押 UI'],
                },
                {
                  phase: '阶段二 · 主网上线',
                  status: '进行中',
                  items: ['Base Mainnet 合约部署完成', '主网质押流程测试', '主网收益领取与团队奖励测试', '正式对外开放'],
                },
                {
                  phase: '阶段三 · 生态增长',
                  status: '规划中',
                  items: ['The Graph 链上事件索引', '服务端团队奖励计算', '多设备通知已读同步', '多语言国际化扩展'],
                },
                {
                  phase: '阶段四 · 生态扩展',
                  status: '规划中',
                  items: ['治理模块（DAO）', '跨链桥接支持', '第三方集成 SDK', '社区自治'],
                },
              ].map(({ phase, status, items }) => (
                <div key={phase} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{phase}</h4>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                      status === '已完成'
                        ? 'bg-green-500/15 text-green-400'
                        : status === '进行中'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {status}
                    </span>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                    {items.map(i => <li key={i}>{i}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          {/* 合约地址 */}
          <Section id="contracts" title="八、合约地址">
            <p className="text-sm text-muted-foreground">
              以下为 Base Mainnet 正式部署地址。
            </p>
            <Table
              headers={['合约', 'Base Mainnet 地址']}
              rows={[
                ['VVV Token',      '0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf'],
                ['VVVEco Staking', '0xc451DdCdDbd9e8700E71960d190b55fE1eD57B34'],
                ['VVVPayout',      '0xc9102200271245660AB1C640CEB502936BDe04E1'],
                ['VVVTreasury',    '0xA223C9e22532a7d985004fe3714AB3D873F4c3a2'],
              ]}
            />
          </Section>

          {/* 页脚 */}
          <div className="border-t border-border pt-8 text-sm text-muted-foreground space-y-2">
            <p>
              本文档仅供参考，不构成任何投资建议。智能合约代码开源，可在 GitHub 查阅。
            </p>
            <p>© 2026 VVVEco Protocol. All rights reserved.</p>
          </div>
        </article>
      </div>
    </div>
  )
}

// ── 布局组件 ─────────────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="text-2xl font-bold tracking-tight border-b border-border pb-2">{title}</h2>
      <div className="space-y-4 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary">
          <tr>
            {headers.map(h => (
              <th key={h} className="px-4 py-2 text-left font-semibold text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-secondary/40 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-2 ${j === 0 ? 'font-medium text-foreground' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-secondary p-4 text-xs leading-relaxed text-foreground font-mono">
      {children}
    </pre>
  )
}
