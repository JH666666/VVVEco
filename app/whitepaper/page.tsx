"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, BookOpen, Globe } from "lucide-react"
import { OfficialLogo } from "@/components/brand/official-logo"

type Lang = "zh" | "en"

function t(zh: string, en: string, lang: Lang) {
  return lang === "zh" ? zh : en
}

const TOC_ZH = [
  { id: "letter",       label: "创始人信" },
  { id: "summary",      label: "执行摘要" },
  { id: "venice",       label: "为什么是 Venice AI" },
  { id: "vvv",          label: "为什么 VVV 重要" },
  { id: "diem",         label: "为什么 DIEM 重要" },
  { id: "vvveco",       label: "为什么 VVVeco 存在" },
  { id: "architecture", label: "生态架构" },
  { id: "flywheel",     label: "社区增长飞轮" },
  { id: "community",    label: "社区体系" },
  { id: "vision",       label: "长期愿景" },
  { id: "roadmap",      label: "路线图" },
  { id: "risk",         label: "风险披露" },
]

const TOC_EN = [
  { id: "letter",       label: "Founder Letter" },
  { id: "summary",      label: "Executive Summary" },
  { id: "venice",       label: "Why Venice AI" },
  { id: "vvv",          label: "Why VVV Matters" },
  { id: "diem",         label: "Why DIEM Matters" },
  { id: "vvveco",       label: "Why VVVeco Exists" },
  { id: "architecture", label: "Ecosystem Architecture" },
  { id: "flywheel",     label: "Community Growth Flywheel" },
  { id: "community",    label: "Community Architecture" },
  { id: "vision",       label: "Long-term Vision" },
  { id: "roadmap",      label: "Roadmap" },
  { id: "risk",         label: "Risk Disclosure" },
]

export default function WhitepaperPage() {
  const [lang, setLang] = useState<Lang>("zh")
  const toc = lang === "zh" ? TOC_ZH : TOC_EN
  const isZh = lang === "zh"

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── TOPBAR ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{isZh ? "返回首页" : "Home"}</span>
          </Link>

          <Link href="/" className="flex items-center gap-2 shrink-0">
            <OfficialLogo size={28} themeAware />
            <span className="font-semibold text-sm">VVVeco</span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1">
              <button
                onClick={() => setLang("zh")}
                className={`px-3 py-0.5 text-xs font-medium rounded-full transition-colors ${
                  isZh ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                中文
              </button>
              <button
                onClick={() => setLang("en")}
                className={`px-3 py-0.5 text-xs font-medium rounded-full transition-colors ${
                  !isZh ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                EN
              </button>
            </div>
            <Link
              href="/ecosystem"
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              {isZh ? "生态介绍" : "Ecosystem"}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:flex lg:gap-10 lg:py-14">
        {/* ── SIDEBAR TOC (desktop) ── */}
        <aside className="hidden lg:block lg:w-52 lg:shrink-0">
          <div className="sticky top-24">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {isZh ? "目录" : "Contents"}
            </p>
            <nav className="space-y-0.5">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block rounded px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors leading-snug"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-6 space-y-2">
              <Link
                href="/ecosystem"
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                {isZh ? "生态介绍页" : "Ecosystem Page"}
              </Link>
              <Link
                href="/stake"
                className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
              >
                {isZh ? "进入质押大厅" : "Enter Staking"}
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </Link>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <article className="min-w-0 flex-1 space-y-14">

          {/* ── COVER ── */}
          <div className="space-y-4 border-b border-border pb-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <BookOpen className="h-3.5 w-3.5" />
              {isZh ? "生态白皮书 · v2.1" : "Ecosystem Whitepaper · v2.1"}
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">VVVeco</h1>
            <p className="text-xl text-muted-foreground">
              {isZh ? "Venice AI 生态社区增长层" : "The Community Growth Layer of Venice AI"}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{isZh ? "发布时间：2026 年 6 月" : "Published: June 2026"}</span>
              <span>·</span>
              <span>{isZh ? "网络：Base Mainnet" : "Network: Base Mainnet"}</span>
              <span>·</span>
              <span>VVVeco v2.1</span>
            </div>
            {/* Mobile CTA */}
            <div className="flex flex-wrap gap-3 pt-2 lg:hidden">
              <Link
                href="/stake"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
              >
                {isZh ? "进入质押大厅" : "Enter Staking"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/ecosystem"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe className="h-4 w-4" />
                {isZh ? "生态介绍" : "Ecosystem"}
              </Link>
            </div>
          </div>

          {/* ── 01 FOUNDER LETTER ── */}
          <WPSection id="letter" index="01" title={isZh ? "创始人信" : "Founder Letter"}>
            <div className="rounded-xl border border-border bg-muted/30 p-6 sm:p-8 space-y-4 text-muted-foreground leading-relaxed">
              {isZh ? (
                <>
                  <p>我们从未想过要做一个 Staking 平台。</p>
                  <p>我们只是在试图回答一个越来越难以回避的问题：<strong className="text-foreground">AI 应该属于谁？</strong></p>
                  <p>今天，超过十亿人在使用 AI。他们用它写作、思考、构建、决策。但其中几乎没有人真正拥有这些 AI。每一次对话都被存储。每一条提示词都成为训练数据。每个月缴纳的费用是租金——不是投资，不是所有权。你用得越多，从你身上提取价值的公司就越强大。这不是技术 bug，而是商业模式本身。</p>
                  <p>Venice AI 基于一个不同的前提而生：AI 必须尊重使用它的人的主权。隐私由架构保障，而非由政策声明。去审查是默认设计，而非特例豁免。运行在开放区块链上，而非封闭云端。结果是：超过一百万用户已经选择在不同条件下使用 AI。</p>
                  <p>VVVeco 存在的原因是：世界上最好的基础设施，仅靠自身远远不够。技术需要社区。叙事需要信仰者。运动需要组织。从"存在一个更好的 AI 平台"到"全世界知道它并使用它"，中间的那段距离，正是 VVVeco 被建立来填补的。</p>
                  <p>我们不要求你信任承诺。我们请你看看已经存在的：Venice 的架构、Venice 的用户规模、VVV 由真实收入支撑的销毁机制、DIEM 的算力所有权模型。然后自己判断：这是否值得围绕它构建一个社区。</p>
                  <p className="font-medium text-foreground">我们认为值得。希望你也这么看。</p>
                  <div className="pt-4 border-t border-border">
                    <p className="font-semibold text-foreground">VVVeco 生态增长团队</p>
                    <p className="text-sm">构建于 Base · 由 VVV 驱动 · 社区是核心引擎</p>
                  </div>
                </>
              ) : (
                <>
                  <p>We did not set out to build a staking platform.</p>
                  <p>We set out to answer a question that keeps getting harder to ignore: <strong className="text-foreground">Who does AI belong to?</strong></p>
                  <p>Today, over a billion people use AI. They use it to write, to think, to build, to decide. But almost none of them own any of it. Every conversation they have is stored. Every prompt they write becomes training data. Every monthly fee they pay is rent — not investment, not ownership. The more they use AI, the stronger the companies that extract value from their usage become. This is not a bug. It is the business model.</p>
                  <p>Venice AI was built on a different premise: that AI must respect the sovereignty of those who use it. Private by architecture, not by policy. Uncensored by design, not by exception. Built on an open blockchain, not a closed cloud. The result is a platform with over one million users who have already chosen to access AI on different terms.</p>
                  <p>VVVeco exists because the best infrastructure in the world is not enough on its own. Technology needs communities. Narratives need people who believe in them. Movements need organization. The distance between "a better AI platform exists" and "the world knows it and uses it" is exactly the distance VVVeco is built to close.</p>
                  <p>We are not asking you to trust promises. We are asking you to look at what exists: Venice's architecture, Venice's users, VVV's real revenue-backed burn, DIEM's compute ownership mechanism. Then decide whether this is the kind of ecosystem worth building a community around.</p>
                  <p className="font-medium text-foreground">We think it is. We hope you agree.</p>
                  <div className="pt-4 border-t border-border">
                    <p className="font-semibold text-foreground">The VVVeco Ecosystem Growth Team</p>
                    <p className="text-sm">Built on Base · Powered by VVV · Driven by Community</p>
                  </div>
                </>
              )}
            </div>
          </WPSection>

          {/* ── 02 EXECUTIVE SUMMARY ── */}
          <WPSection id="summary" index="02" title={isZh ? "执行摘要" : "Executive Summary"}>
            <p className="text-muted-foreground leading-relaxed">
              {isZh
                ? "人工智能行业正在经历第一场真正意义上的主权危机。数亿用户每天与 AI 系统交互，这些系统存储他们的数据、限制他们的使用、将他们的行为转化为企业训练资产——未经实质性授权，没有任何利益共享。"
                : "The artificial intelligence industry is undergoing its first major sovereignty crisis. Hundreds of millions of users interact daily with AI systems that store their data, restrict their usage, and convert their behavior into corporate training assets — without meaningful consent or benefit-sharing."}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
              {[
                { val: isZh ? "100万+" : "1M+",  lbl: isZh ? "Venice 用户" : "Venice Users" },
                { val: "250+",                    lbl: isZh ? "AI 模型" : "AI Models" },
                { val: "4",                       lbl: isZh ? "隐私等级" : "Privacy Tiers" },
                { val: isZh ? "1亿" : "100M",     lbl: isZh ? "VVV 初始供应量" : "VVV Initial Supply" },
              ].map(({ val, lbl }) => (
                <div key={lbl} className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{val}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground uppercase tracking-wide">{lbl}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p><strong className="text-foreground">Venice AI</strong>{isZh ? " 是为解决这一问题而构建的基础设施层：一个运行在 Base 上的隐私原生 AI 平台，拥有超过 100 万用户、250+ 模型、四级密码学隐私架构，以及零提示词数据留存的架构设计。" : " is the infrastructure layer built to solve this: a privacy-native AI platform on Base with 1,000,000+ users, 250+ models, four cryptographic privacy tiers, and zero prompt data retention by architecture."}</p>
              <p><strong className="text-foreground">VVV</strong>{isZh ? " 是连接访问权、参与权与生态价值的协调代币。质押 VVV 可解锁 Venice Pro 访问权并获得铸造 DIEM 的资格。月度平台收入用于回购并销毁 VVV，形成与真实商业增长挂钩的通缩飞轮。" : " is the coordination token that connects access, participation, and ecosystem value. Staking VVV unlocks Venice Pro access and the right to mint DIEM. Monthly platform revenue buys and burns VVV, creating a deflationary flywheel tied to real commercial growth."}</p>
              <p><strong className="text-foreground">DIEM</strong>{isZh ? " 是 Venice 的第二个代币，也是生态中最具原创性的产品创新。1 DIEM = 每天 1 美元的 AI 算力额度，永久有效。DIEM 将 AI 访问权从消耗性订阅转变为永久性、可转让、可组合的链上资产。" : " is Venice's second token — and a genuine product innovation. 1 DIEM = $1 of daily AI compute credits, forever. DIEM converts AI access from a consumable subscription into a perpetual, transferable, DeFi-composable on-chain asset."}</p>
              <p><strong className="text-foreground">VVVeco</strong>{isZh ? " 是社区增长层——让上述一切在规模上真正落地的力量。VVVeco 不是收益平台，它是共同构建 AI 主权时代的组织化社区。" : " is the community growth layer that makes all of this matter at scale. VVVeco is not a yield platform. It is the organized community of people building the AI sovereignty era."}</p>
            </div>
          </WPSection>

          {/* ── 03 WHY VENICE AI ── */}
          <WPSection id="venice" index="03" title={isZh ? "为什么是 Venice AI" : "Why Venice AI"}>
            <p className="text-muted-foreground leading-relaxed">{isZh ? "Venice AI 不是模型提供商，不是 AI 研究机构，也不是 DeFi 协议。它是隐私原生的 AI 访问基础设施——一个精密的路由与隐私层，位于用户与全球最优秀 AI 模型之间。" : "Venice AI is not a model provider, not an AI research lab, and not a DeFi protocol. It is privacy-native AI access infrastructure — a sophisticated routing and privacy layer that sits between users and the world's best AI models."}</p>
            <Callout>{isZh ? "\"实现合理用户隐私的唯一方式，是从一开始就不收集这些信息。这在工程上更难，但我们相信这是正确的做法。\" — Venice AI" : "\"The only way to achieve reasonable user privacy is to avoid collecting this information in the first place. This is harder to do from an engineering perspective, but we believe it is the correct approach.\" — Venice AI"}</Callout>
            <h3 className="text-base font-semibold mt-6 mb-3">{isZh ? "四级隐私架构" : "Four-Tier Privacy Architecture"}</h3>
            <WPTable
              headers={isZh ? ["隐私等级", "保护内容", "适用场景"] : ["Privacy Tier", "Protection", "Use Case"]}
              rows={isZh ? [
                ["Anonymous", "向提供商隐藏用户身份", "一般使用，访问闭源模型"],
                ["Private", "合约保证零数据留存，推理后即销毁", "商业敏感查询"],
                ["TEE", "可信执行环境，硬件隔离推理，支持远程证明", "企业合规，高敏感场景"],
                ["E2EE", "客户端加密，Venice 只转发密文，仅 TEE 解密", "最高隐私需求"],
              ] : [
                ["Anonymous", "Identity hidden from model provider", "General use, closed-source model access"],
                ["Private", "Zero retention, contract-enforced, destroyed post-inference", "Sensitive commercial queries"],
                ["TEE", "Hardware-isolated inference inside Trusted Execution Environment", "Enterprise compliance, high-sensitivity"],
                ["E2EE", "Client-side encryption; Venice relays ciphertext only; only TEE decrypts", "Maximum privacy requirement"],
              ]}
            />
            <p className="text-muted-foreground leading-relaxed mt-4">{isZh ? "OpenAI、Anthropic 和 Google 无法提供 Venice 能提供的隐私保障——不是工程能力的限制，而是商业模式的结构性约束。Venice 的收入来源是访问费，而非数据。这一结构性差异使 Venice 的隐私架构成为可持续的竞争护城河。" : "OpenAI, Anthropic, and Google cannot offer the privacy guarantees Venice offers — not because of engineering limitations, but because of business model constraints. Venice's revenue comes from access fees, not data. This structural difference makes Venice's privacy architecture a sustainable competitive moat."}</p>
          </WPSection>

          {/* ── 04 WHY VVV ── */}
          <WPSection id="vvv" index="04" title={isZh ? "为什么 VVV 重要" : "Why VVV Matters"}>
            <p className="text-muted-foreground leading-relaxed">{isZh ? "VVV 不是治理代币，不是投机资产。它是连接 Venice 基础设施与参与者、并驱动通缩飞轮的经济协调机制——这一飞轮锚定于真实的平台收入。" : "VVV is not a governance token. It is not a speculative asset. It is the economic coordination mechanism that connects Venice's infrastructure to its participants, and drives a deflationary flywheel anchored in real revenue."}</p>
            <h3 className="text-base font-semibold mt-6 mb-3">{isZh ? "VVV 的三大功能" : "Three Functions of VVV"}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {(isZh ? [
                { n: "I", title: "生态访问权", desc: "质押 100 VVV 即可解锁 Venice Pro：无限制文本推理、顶级图像与视频生成模型、完整高级功能。访问权与持有绑定，而非月度付款。" },
                { n: "II", title: "DIEM 铸造权", desc: "所有 DIEM 均由 VVV 铸造产生。VVV 质押者是唯一可以铸造 DIEM 的主体。VVV 是整个 DIEM 算力经济的上游供应门控。" },
                { n: "III", title: "通缩飞轮", desc: "自 2025 年 11 月起，Venice 月度平台收入的一部分用于从公开市场回购 VVV 并永久销毁。更多用户 → 更多收入 → 更多销毁 → 供应减少。" },
              ] : [
                { n: "I", title: "Ecosystem Access", desc: "Staking 100 VVV unlocks Venice Pro: unlimited text inference, leading image and video generation models, and advanced features. Access is tied to holding, not to monthly payment." },
                { n: "II", title: "DIEM Minting Rights", desc: "All DIEM is created from VVV. VVV stakers who lock their stake can mint DIEM tokens. VVV is the upstream supply gate of the entire DIEM compute economy." },
                { n: "III", title: "Deflationary Flywheel", desc: "Beginning November 2025, a portion of Venice's monthly platform revenue is used to buy VVV from the open market and permanently burn it. More users → more revenue → more burns → less supply." },
              ]).map(({ n, title, desc }) => (
                <div key={n} className="rounded-xl border border-border bg-muted/20 p-5">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">Function {n}</div>
                  <h4 className="font-semibold mb-2">{title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <h3 className="text-base font-semibold mt-8 mb-3">{isZh ? "代币参数" : "Token Parameters"}</h3>
            <WPTable
              headers={isZh ? ["参数", "数值"] : ["Parameter", "Value"]}
              rows={isZh ? [
                ["公链", "Base（以太坊 L2）"],
                ["标准", "ERC-20"],
                ["初始供应量", "100,000,000 VVV"],
                ["上线日期", "2025 年 1 月 27 日"],
                ["Pro 访问质押门槛", "质押 100 VVV"],
                ["回购销毁启动", "2025 年 11 月（月度，持续进行）"],
                ["Coinbase 排名", "前 1% 代币"],
              ] : [
                ["Chain", "Base (Ethereum L2)"],
                ["Standard", "ERC-20"],
                ["Initial Supply", "100,000,000 VVV"],
                ["Launch Date", "January 27, 2025"],
                ["Pro Access Threshold", "Stake 100 VVV"],
                ["Buy & Burn Commencement", "November 2025 (monthly, ongoing)"],
                ["Coinbase Ranking", "Top 1% of tokens on Coinbase"],
              ]}
            />
          </WPSection>

          {/* ── 05 WHY DIEM ── */}
          <WPSection id="diem" index="05" title={isZh ? "为什么 DIEM 重要" : "Why DIEM Matters"}>
            <p className="text-muted-foreground leading-relaxed">{isZh ? "DIEM 是 Venice 的第二个代币，也是整个生态中最具意义的产品创新。它回答了一个 AI 行业此前从未有人回答过的问题：如果你可以拥有 AI 访问权，而不只是租用它，会怎样？" : "DIEM is Venice's second token, and the most significant product innovation in the Venice ecosystem. It answers a question that no one in the AI industry had previously answered: What if you could own your AI access instead of renting it?"}</p>
            <Callout>{isZh ? "1 DIEM = 在 Venice 上每天价值 1 美元的 AI 推理额度。永久有效，无过期，无需续费，无法被取消。" : "1 DIEM = $1 of daily AI inference credits on Venice. Forever. No expiration. No renewal. No cancellation."}</Callout>
            <h3 className="text-base font-semibold mt-6 mb-3">{isZh ? "所有权的本质转变" : "The Ownership Shift"}</h3>
            <WPTable
              headers={isZh ? ["维度", "传统 AI 订阅", "DIEM"] : ["Dimension", "Traditional AI Subscription", "DIEM"]}
              rows={isZh ? [
                ["本质", "可消耗的服务", "永久性资产"],
                ["所有权", "无——你在租用访问权", "完整所有权——你持有资产"],
                ["可转让性", "不可转让", "可在 DEX 自由交易"],
                ["停止付款后", "访问权被撤销", "访问权继续（资产仍存在）"],
                ["DeFi 可组合性", "无", "抵押品、DAO 治理、Agent 使用"],
              ] : [
                ["Nature", "Consumable service", "Perpetual asset"],
                ["Ownership", "None — you rent access", "Full — you hold an asset"],
                ["Transferability", "Non-transferable", "Freely tradeable on DEX"],
                ["If you stop paying", "Access revoked", "Access continues (asset persists)"],
                ["DeFi Composability", "None", "Collateral, DAO governance, agent use"],
              ]}
            />
          </WPSection>

          {/* ── 06 WHY VVVECO EXISTS ── */}
          <WPSection id="vvveco" index="06" title={isZh ? "为什么 VVVeco 存在" : "Why VVVeco Exists"}>
            <Callout>{isZh ? "技术创造可能性。社区创造采用。两者之间的距离，正是生态系统成败的关键所在。" : "Technology creates possibility. Communities create adoption. The gap between them is where ecosystems succeed or fail."}</Callout>
            <p className="text-muted-foreground leading-relaxed">{isZh ? "Venice AI 已经建立了真正差异化的基础设施。VVV 和 DIEM 已经创建了真正创新的经济模型。但技术史上充满了产品更优却未能实现大规模采用的案例——原因正是缺少能够将技术价值转化为人类理解和参与的社区层。VVVeco 就是这个层。" : "Venice AI has built genuinely differentiated infrastructure. VVV and DIEM have created a genuinely novel economic model. But the history of technology is full of superior products that failed to achieve adoption because they lacked the community layer to translate technical value into human understanding and participation. VVVeco is that layer."}</p>
            <h3 className="text-base font-semibold mt-6 mb-3">{isZh ? "VVVeco 填补的三大结构性缺口" : "Three Structural Gaps VVVeco Fills"}</h3>
            <div className="space-y-3">
              {(isZh ? [
                { n: "01", title: "认知缺口", desc: "AI 隐私架构、DIEM 算力所有权、Agent 经济基础设施——这些都是全新概念，需要主动翻译才能被主流社区理解。VVVeco 构建并传播教育内容。" },
                { n: "02", title: "连接缺口", desc: "Venice AI 是全球产品，但全球采用需要本地桥梁。在每种语言、每个区域社区中，都需要有人成为节点。VVVeco 构建这一节点网络。" },
                { n: "03", title: "参与缺口", desc: "真实存在着一批人——他们相信 AI 不应该属于少数几家公司——但他们分散、无序，没有清晰的行动路径。VVVeco 是将信念转化为有组织行动的组织形态。" },
              ] : [
                { n: "01", title: "The Education Gap", desc: "AI privacy architecture, DIEM compute ownership, Agent economy infrastructure — these are genuinely new concepts that require active translation. VVVeco builds and distributes the educational content that turns technical facts into community knowledge." },
                { n: "02", title: "The Connection Gap", desc: "Venice AI is a global product, but global adoption requires local bridges. In every language and every regional community, someone needs to be the node. VVVeco builds this network of nodes." },
                { n: "03", title: "The Participation Gap", desc: "There is a real and growing population who believe AI should not belong to a handful of corporations — but they are dispersed and without a clear way to act. VVVeco is the organizational form that turns belief into coordinated action." },
              ]).map(({ n, title, desc }) => (
                <div key={n} className="flex gap-4 rounded-xl border border-border bg-muted/20 p-5">
                  <span className="mt-0.5 text-xl font-bold text-primary/30 shrink-0">{n}</span>
                  <div>
                    <h4 className="font-semibold mb-1">{title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </WPSection>

          {/* ── 07 ECOSYSTEM ARCHITECTURE ── */}
          <WPSection id="architecture" index="07" title={isZh ? "生态架构" : "Ecosystem Architecture"}>
            <p className="text-muted-foreground leading-relaxed">{isZh ? "Venice AI 生态最好被理解为一个垂直堆叠结构，每一层都依赖并服务于其相邻层。VVVeco 占据最接近用户的层——社区与采用层，是底层基础设施触达世界的界面。" : "The Venice AI ecosystem is best understood as a vertical stack, where each layer depends on and serves the layers adjacent to it. VVVeco occupies the layer closest to the user — the community and adoption interface through which the underlying infrastructure reaches the world."}</p>
            <div className="mt-6 divide-y divide-border rounded-xl border border-border overflow-hidden">
              {(isZh ? [
                { layer: "采用层", desc: "全球认知扩散、更广泛的使用规模、生态系统体量——所有下层正在努力实现的最终结果", tag: "目标结果", color: "text-green-600 dark:text-green-400 bg-green-500/10" },
                { layer: "社区层", desc: "教育、参与、KOL、Ambassador、区域社区——推动采用的人类网络", tag: "VVVeco", color: "text-primary bg-primary/10" },
                { layer: "协调层", desc: "访问权利、经济对齐、参与激励、铸造权利、通缩机制", tag: "VVV + DIEM", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10" },
                { layer: "基础设施层", desc: "私密 AI 推理、250+ 模型、四级隐私架构、x402 支付、Agentic Chat", tag: "Venice AI", color: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10" },
                { layer: "结算层", desc: "低成本、高吞吐量的链上经济——所有代币活动的区块链基础", tag: "Base", color: "text-muted-foreground bg-muted/50" },
              ] : [
                { layer: "Adoption", desc: "Global awareness, broader usage, ecosystem scale — the outcome all lower layers are working toward", tag: "Outcome", color: "text-green-600 dark:text-green-400 bg-green-500/10" },
                { layer: "Community", desc: "Education, participation, KOLs, Ambassadors, regional communities — the human network that drives adoption", tag: "VVVeco", color: "text-primary bg-primary/10" },
                { layer: "Coordination", desc: "Access rights, economic alignment, participation incentives, minting rights, deflationary mechanics", tag: "VVV + DIEM", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10" },
                { layer: "Infrastructure", desc: "Private AI inference, 250+ models, four-tier privacy architecture, x402 payments, Agentic Chat", tag: "Venice AI", color: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10" },
                { layer: "Settlement", desc: "Low-cost, high-throughput on-chain economy — the blockchain foundation for all token activity", tag: "Base", color: "text-muted-foreground bg-muted/50" },
              ]).map(({ layer, desc, tag, color }) => (
                <div key={layer} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                  <span className="w-24 text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">{layer}</span>
                  <p className="flex-1 text-sm text-muted-foreground leading-snug">{desc}</p>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md shrink-0 ${color}`}>{tag}</span>
                </div>
              ))}
            </div>
          </WPSection>

          {/* ── 08 COMMUNITY GROWTH FLYWHEEL ── */}
          <WPSection id="flywheel" index="08" title={isZh ? "社区增长飞轮" : "Community Growth Flywheel"}>
            <p className="text-muted-foreground leading-relaxed">{isZh ? "VVVeco 的飞轮在结构上与大多数 Web3 项目不同。它的核心是生态价值，不是金融收益。" : "VVVeco's flywheel is structurally different from most Web3 projects. Its center is ecosystem value, not financial yield."}</p>
            <div className="my-6 flex items-center justify-center gap-2 flex-wrap rounded-xl border border-border bg-muted/20 p-6">
              {(isZh ? ["参与", "教育", "社区扩张", "VVV 采用", "生态强化"] : ["Participation", "Education", "Community Expansion", "VVV Adoption", "Ecosystem Strength"]).map((step, i, arr) => (
                <div key={step} className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-10 w-10 rounded-full border-2 border-primary/40 bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">0{i + 1}</div>
                    <span className="text-[11px] text-muted-foreground text-center max-w-[64px] leading-tight">{step}</span>
                  </div>
                  {i < arr.length - 1 && <span className="text-muted-foreground/40 text-lg mb-4">→</span>}
                </div>
              ))}
              <div className="flex items-center gap-2 ml-1">
                <span className="text-muted-foreground/40 text-lg mb-4">→</span>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-10 w-10 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center text-lg text-primary font-bold">↺</div>
                  <span className="text-[11px] text-primary text-center max-w-[64px] leading-tight">{isZh ? "循环" : "Cycle"}</span>
                </div>
              </div>
            </div>
            <WPTable
              headers={isZh ? ["阶段", "机制", "VVVeco 角色"] : ["Stage", "Mechanism", "VVVeco Role"]}
              rows={isZh ? [
                ["参与", "更多用户、Builder、Leader 进入 Venice 生态", "提供入场路径和社区基础设施"],
                ["教育", "Venice 的价值被更广泛理解，知识门槛降低", "以各种语言制作和分发教育内容"],
                ["社区扩张", "KOL、Ambassador 和区域节点放大影响力", "管理 KOL 网络和 Ambassador 计划"],
                ["VVV 采用", "更多参与者质押 VVV、铸造 DIEM、深度参与", "教育 VVV 效用和 DIEM 算力所有权"],
                ["生态强化", "使用量增长 → 收入增长 → VVV 销毁加速", "社区增长直接反哺收入飞轮"],
              ] : [
                ["Participation", "More users, builders, and leaders enter Venice ecosystem", "Provides the entry paths and community infrastructure"],
                ["Education", "Venice's value is more broadly understood; knowledge barriers fall", "Produces and distributes educational content in all languages"],
                ["Community Expansion", "KOLs, Ambassadors, and regional nodes amplify reach", "Manages the KOL network and Ambassador program"],
                ["VVV Adoption", "More participants stake VVV, mint DIEM, deepen engagement", "Educates on VVV utility and DIEM compute ownership"],
                ["Ecosystem Strength", "Usage grows → revenue grows → VVV burn accelerates", "Community growth directly feeds the revenue flywheel"],
              ]}
            />
          </WPSection>

          {/* ── 09 COMMUNITY ARCHITECTURE ── */}
          <WPSection id="community" index="09" title={isZh ? "社区体系" : "Community Architecture"}>
            <p className="text-muted-foreground leading-relaxed">{isZh ? "VVVeco 的社区以同心圆结构组织，从最活跃的核心构建者向外延伸至更广泛的生态参与者。每个圈层都有明确的角色定义、职责集合和相应的参与深度。" : "VVVeco's community is structured in concentric rings, from the most active core builders outward to the broader ecosystem participants. Each ring has a defined role, a set of responsibilities, and a corresponding depth of engagement."}</p>
            <h3 className="text-base font-semibold mt-6 mb-3">{isZh ? "三大核心叙事支柱" : "Three Core Narrative Pillars"}</h3>
            <WPTable
              headers={isZh ? ["支柱", "核心主张", "技术锚点"] : ["Pillar", "Core Claim", "Technical Anchor"]}
              rows={isZh ? [
                ["AI 主权", "你的 AI，你的数据，你的控制权——密码学强制保障", "Venice 的 Private/TEE/E2EE 隐私架构"],
                ["AI 算力所有权", "将 AI 访问权作为永久资产持有，而非订阅服务", "DIEM：1 DIEM = 每天 1 美元算力，永久有效"],
                ["Agent 经济基础设施", "Venice 是自主 Agent 的原生 AI 基础设施", "x402 USDC 支付协议、DIEM Agent 持有机制"],
              ] : [
                ["AI Sovereignty", "Your AI, your data, your control — cryptographically enforced", "Venice's Private/TEE/E2EE privacy architecture"],
                ["AI Compute Ownership", "Own your AI access as a perpetual asset, not a subscription", "DIEM: 1 DIEM = $1/day compute, forever"],
                ["Agent Economy Infrastructure", "Venice is the native AI infrastructure for autonomous agents", "x402 USDC payment protocol, DIEM agent holding"],
              ]}
            />
          </WPSection>

          {/* ── 10 LONG-TERM VISION ── */}
          <WPSection id="vision" index="10" title={isZh ? "长期愿景" : "Long-term Vision"}>
            <Callout>{isZh ? "一个 AI 的力量真正服务于使用者的世界——隐私是权利而非特权，算力是资产而非服务，社区是生态增长的核心引擎而非附注。" : "A world where AI's power truly serves those who use it — where privacy is a right, not a privilege; where compute is an asset, not a service; and where community is the core engine of ecosystem growth, not a footnote."}</Callout>
            <h3 className="text-base font-semibold mt-6 mb-2">{isZh ? "使命" : "Mission"}</h3>
            <p className="text-muted-foreground leading-relaxed">{isZh ? "连接 AI 主权的信仰者，构建 Venice AI 生态系统的全球社区增长网络，确保每一个使用 AI 的人都能掌控自己的数据、拥有自己的算力、并有权参与其中。" : "To connect believers in AI sovereignty, build the global community growth network of the Venice AI ecosystem, and ensure every person who uses AI can own their data, their compute, and their right to participate."}</p>
            <h3 className="text-base font-semibold mt-6 mb-3">{isZh ? "VVVeco 的目标图景" : "Where VVVeco Is Going"}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(isZh ? [
                { title: "全球社区网络", desc: "在 30 个以上主要全球市场建立活跃的 VVVeco 社区节点，每个节点配有本地 Ambassador、本地语言内容和本地社区活动。" },
                { title: "叙事领导力", desc: "VVVeco 对 AI 数据主权的叙事框架成为 Web3 中 AI 所有权讨论的标准参考，建立行业词汇。" },
                { title: "开发者生态", desc: "数百个基于 Venice API 构建的应用，使用 DIEM 进行算力预算管理，蓬勃发展的开发者社区。" },
                { title: "Agent 经济中心", desc: "随着 AI Agent 采用规模化，Venice 成为自主 Agent 的首选 AI 基础设施，VVVeco 社区是其人类网络。" },
              ] : [
                { title: "Global Community Network", desc: "Active VVVeco community nodes in 30+ major global markets, each with local Ambassadors, local-language content, and local community events." },
                { title: "Narrative Leadership", desc: "VVVeco's framing of AI data sovereignty becomes the standard reference in Web3 discussions about AI ownership." },
                { title: "Developer Ecosystem", desc: "Hundreds of applications built on Venice API using DIEM for compute budget management — a thriving developer community." },
                { title: "Agent Economy Hub", desc: "As AI Agent adoption scales, Venice becomes the preferred AI infrastructure for autonomous agents. VVVeco's community is the human network around it." },
              ]).map(({ title, desc }) => (
                <div key={title} className="rounded-xl border border-border bg-muted/20 p-5">
                  <h4 className="font-semibold mb-2">{title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </WPSection>

          {/* ── 11 ROADMAP ── */}
          <WPSection id="roadmap" index="11" title={isZh ? "路线图" : "Roadmap"}>
            <p className="text-muted-foreground leading-relaxed">{isZh ? "VVVeco 的路线图围绕生态发展里程碑组织，而非代币解锁时间表。每个阶段代表社区能力和生态影响力的实质性扩张。" : "VVVeco's roadmap is organized around ecosystem development milestones, not token vesting schedules. Each phase represents a meaningful expansion of community capacity and ecosystem impact."}</p>
            <div className="mt-6 space-y-4">
              {(isZh ? [
                { phase: "阶段一", label: "01 — 基础建设", title: "叙事统一与知识基础设施", items: ["Narrative Bible 最终确定（所有传播的主权威文件）", "生态白皮书正式发布", "知识库建立：研究报告、One Pager、FAQ 文库", "核心 KOL 初步触达与首批合作建立", "社区渠道激活上线"] },
                { phase: "阶段二", label: "02 — 增长", title: "社区激活与网络扩张", items: ["Ambassador 计划正式启动", "KOL 网络扩展至重点市场（东南亚、东亚、拉丁美洲）", "教育内容库规模化扩充与本地化", "社区指标体系建立并持续追踪", "开发者社区参与启动"] },
                { phase: "阶段三", label: "03 — 扩张", title: "区域节点与生态合作", items: ["10 个以上主要市场建立区域社区节点", "与 Base 生态项目建立战略合作", "DIEM 算力经济专项教育推广", "开发者黑客松与构建计划"] },
                { phase: "阶段四", label: "04 — 生态成熟", title: "全球社区网络与长期可持续性", items: ["30 个以上活跃全球社区节点", "由本地领导层驱动的自我维持型 Ambassador 计划", "VVVeco 成为 Web3 中公认的 AI 主权社区", "长期社区治理机制建立"] },
              ] : [
                { phase: "Phase 1", label: "01 — Foundation", title: "Narrative Unification & Knowledge Infrastructure", items: ["Narrative Bible finalized (master document for all communication)", "Ecosystem Whitepaper published", "Knowledge base established: research reports, One Pagers, FAQ library", "Core KOL initial outreach and first partnerships", "Community channels activated"] },
                { phase: "Phase 2", label: "02 — Growth", title: "Community Activation & Network Expansion", items: ["Ambassador program officially launched", "KOL network expanded across key markets (Southeast Asia, East Asia, Latin America)", "Educational content library scaled and localized", "Community metrics framework established and tracked", "Developer community engagement initiated"] },
                { phase: "Phase 3", label: "03 — Expansion", title: "Regional Nodes & Ecosystem Partnerships", items: ["Regional community nodes established in 10+ major markets", "Strategic partnerships with Base ecosystem projects", "DIEM compute economy education campaign", "Developer hackathons and build programs"] },
                { phase: "Phase 4", label: "04 — Ecosystem", title: "Global Community Network & Long-term Sustainability", items: ["30+ active global community nodes", "Self-sustaining Ambassador program with local leadership", "VVVeco as recognized AI sovereignty community in Web3", "Long-term community governance mechanisms"] },
              ]).map(({ label, title, items }, i) => (
                <div key={label} className="flex gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="h-8 w-8 rounded-full border-2 border-primary/50 bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {i + 1}
                    </div>
                    {i < 3 && <div className="w-px flex-1 bg-border mt-1 min-h-[24px]" />}
                  </div>
                  <div className="pb-6 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">{label}</div>
                    <h4 className="font-semibold mb-2">{title}</h4>
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                          <span className="text-primary mt-0.5 shrink-0">→</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </WPSection>

          {/* ── 12 RISK DISCLOSURE ── */}
          <WPSection id="risk" index="12" title={isZh ? "风险披露" : "Risk Disclosure"}>
            <p className="text-muted-foreground leading-relaxed">{isZh ? "本白皮书代表我们对 VVVeco 机遇与策略的真实评估。以下风险是真实的、实质性的，任何参与 VVVeco 生态的人都应当理解。" : "This whitepaper represents our genuine assessment of VVVeco's opportunity and strategy. The following risks are real, material, and should be understood by anyone participating in the VVVeco ecosystem."}</p>
            <div className="mt-4 space-y-3">
              {(isZh ? [
                { level: "高", levelEn: "HIGH", title: "第三方模型提供商依赖风险", desc: "Venice 聚合了来自 OpenAI、Anthropic、Google、Meta 等的模型。这些提供商可能变更其 API 条款、限制特定使用场景、提高价格或终止访问授权。VVV 代币价值会因此受到实质性影响。", color: "bg-red-500/10 text-red-500" },
                { level: "高", levelEn: "HIGH", title: "平台集中风险", desc: "VVV 和 DIEM 的价值完全依赖于 Venice 平台的持续运营和商业成功。这两个代币在 Venice 生态之外没有独立的价值来源。", color: "bg-red-500/10 text-red-500" },
                { level: "中", levelEn: "MED", title: "隐私架构透明度限制", desc: "\"匿名\"隐私等级不能阻止第三方提供商查看提示词内容。Venice 隐藏用户身份，但提供商仍可能看到提示词。真正的完整隐私保护需选择 Private 级别或以上模型。", color: "bg-amber-500/10 text-amber-500" },
                { level: "中", levelEn: "MED", title: "监管风险（内容与代币）", desc: "Venice 的去审查内容定位可能在某些司法管辖区引起监管关注。VVV 和 DIEM 作为加密代币在不同市场面临不同的法律定性。参与者应评估自身所在的监管环境。", color: "bg-amber-500/10 text-amber-500" },
                { level: "中", levelEn: "MED", title: "智能合约风险", desc: "VVV 和 DIEM 合约部署在 Base 上，可公开审计。与所有智能合约一样，未被检测到的漏洞仍有可能存在。参与者应仅通过 Venice 官方渠道验证合约地址。", color: "bg-amber-500/10 text-amber-500" },
              ] : [
                { level: "HIGH", levelEn: "HIGH", title: "Third-Party Model Provider Dependency", desc: "Venice aggregates models from OpenAI, Anthropic, Google, Meta, and others. These providers may change their API terms, restrict specific use cases, raise prices, or terminate access. VVV token value would be materially impacted.", color: "bg-red-500/10 text-red-500" },
                { level: "HIGH", levelEn: "HIGH", title: "Platform Concentration Risk", desc: "The value of both VVV and DIEM is entirely dependent on Venice platform's continued operation and commercial success. There is no independent value source for these tokens outside the Venice ecosystem.", color: "bg-red-500/10 text-red-500" },
                { level: "MED", levelEn: "MED", title: "Privacy Architecture Transparency Limitation", desc: "The 'Anonymous' privacy tier does not prevent third-party providers from viewing prompt content. Venice conceals the user's identity, but the provider may still see the prompt. Full prompt privacy requires Private, TEE, or E2EE models.", color: "bg-amber-500/10 text-amber-500" },
                { level: "MED", levelEn: "MED", title: "Regulatory Risk (Content & Token)", desc: "Venice's uncensored content positioning may attract regulatory attention in certain jurisdictions. VVV and DIEM face varying legal classifications across different markets. Participants should assess their own regulatory environment.", color: "bg-amber-500/10 text-amber-500" },
                { level: "MED", levelEn: "MED", title: "Smart Contract Risk", desc: "VVV and DIEM contracts are deployed on Base and are publicly auditable. As with all smart contracts, undetected vulnerabilities remain a possibility. Verify contract addresses through official Venice channels only.", color: "bg-amber-500/10 text-amber-500" },
              ]).map(({ level, title, desc, color }) => (
                <div key={title} className="rounded-xl border border-border bg-muted/10 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${color}`}>{level}</span>
                    <h4 className="font-semibold text-sm">{title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted-foreground leading-relaxed font-medium border-t border-border pt-4">
              {isZh
                ? "本白皮书中的任何内容均不构成财务、法律或投资建议。参与者在做出任何决定前，应进行独立研究并寻求合格专业顾问的意见。"
                : "No content in this whitepaper constitutes financial, legal, or investment advice. Participants are encouraged to conduct their own research and consult qualified advisors before making any decisions."}
            </p>
          </WPSection>

          {/* ── FOOTER ── */}
          <div className="border-t border-border pt-8 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/stake"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
              >
                {isZh ? "进入质押大厅" : "Enter Staking"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/ecosystem"
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe className="h-4 w-4" />
                {isZh ? "查看生态介绍" : "Explore Ecosystem"}
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              {isZh
                ? "本文件仅供参考，不构成任何投资建议。© 2026 VVVeco. All rights reserved."
                : "This document is provided for informational purposes only. © 2026 VVVeco. All rights reserved."}
            </p>
          </div>

        </article>
      </div>
    </div>
  )
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function WPSection({ id, index, title, children }: { id?: string; index: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{index}</span>
        <h2 className="mt-1 text-2xl font-bold tracking-tight border-b border-border pb-3">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-r-xl border-l-4 border-primary bg-primary/5 px-5 py-4 text-[15px] leading-relaxed text-foreground">
      {children}
    </div>
  )
}

function WPTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/20 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-3 leading-snug ${j === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
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
