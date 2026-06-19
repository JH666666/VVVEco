"use client";

import {
  ArrowDown,
  ArrowRight,
  Blocks,
  BookOpen,
  Bot,
  Braces,
  Check,
  ChevronRight,
  CircleDot,
  Globe2,
  LockKeyhole,
  Menu,
  Network,
  Radar,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/language-context";
import { BrandMark } from "./brand-mark";
import { CommunityArchitecture } from "./community-architecture";
import { DiemBridge } from "./diem-bridge";
import { EcosystemMap } from "./ecosystem-map";
import { FutureFrontiers } from "./future-frontiers";
import { GrowthFlywheel } from "./growth-flywheel";
import { HeroNetwork } from "./hero-network";
import { Section } from "./section";
import { VvvOrbit } from "./vvv-orbit";

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { language: lang, setLanguage } = useLanguage();
  const isZh = lang === "zh";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const changeLanguage = (nextLanguage: "zh" | "en") => {
    setLanguage(nextLanguage);
    setMenuOpen(false);
    document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en";
  };

  useEffect(() => {
    document.documentElement.lang = isZh ? "zh-CN" : "en";
  }, [isZh]);

  const capabilities = isZh
    ? [
        { number: "01", icon: CircleDot, title: "生态参与", copy: "为长期 VVV 参与建立清晰、可信的生态入口，让使用、贡献与社区协作进入同一框架。" },
        { number: "02", icon: Users, title: "社区激活", copy: "支持教育、传播、活动与社区组织，让复杂的 AI 价值被更多参与者真正理解。" },
        { number: "03", icon: Network, title: "网络扩张", copy: "连接 KOL、建设者和区域社区，把分散的关注转化为持续扩张的生态网络。" },
        { number: "04", icon: ShieldCheck, title: "链上透明", copy: "基于 Base 记录关键参与和生态协作，提升社区增长过程的可验证性与长期信任。" },
      ]
    : [
        { number: "01", icon: CircleDot, title: "Ecosystem Participation", copy: "Create a clear and credible gateway for long-term VVV participation, connecting usage, contribution and community collaboration." },
        { number: "02", icon: Users, title: "Community Activation", copy: "Support education, communication, events and organization so more participants can understand the value of private AI." },
        { number: "03", icon: Network, title: "Network Expansion", copy: "Connect KOLs, builders and regional communities, turning distributed attention into a continuously expanding network." },
        { number: "04", icon: ShieldCheck, title: "On-chain Transparency", copy: "Record key participation and ecosystem collaboration on Base to strengthen verifiability and long-term trust." },
      ];

  const roadmap = isZh
    ? [
        { phase: "01", title: "基础建设", status: "进行中", items: ["主网基础", "社区形成", "白皮书发布"] },
        { phase: "02", title: "增长", status: "下一阶段", items: ["社区扩张", "KOL 网络", "全球认知"] },
        { phase: "03", title: "扩张", status: "规划中", items: ["生态合作", "AI 社区整合", "区域网络"] },
        { phase: "04", title: "生态共建", status: "长期愿景", items: ["全球社区", "长期可持续", "共同建设生态"] },
      ]
    : [
        { phase: "01", title: "Foundation", status: "ACTIVE", items: ["Mainnet foundation", "Community formation", "Whitepaper release"] },
        { phase: "02", title: "Growth", status: "NEXT", items: ["Community expansion", "KOL network", "Global awareness"] },
        { phase: "03", title: "Expansion", status: "PLANNED", items: ["Ecosystem partnerships", "AI community integration", "Regional networks"] },
        { phase: "04", title: "Ecosystem", status: "VISION", items: ["Global community", "Long-term sustainability", "Co-built ecosystem"] },
      ];

  return (
    <div className={`ecosystem-site site-shell lang-${lang}`}>
      <div className="ambient-field ambient-one" />
      <div className="ambient-field ambient-two" />

      <header className={`topbar ${scrolled ? "is-scrolled" : ""}`}>
        <div className="page-container nav-inner">
          <a href="#top" onClick={closeMenu}><BrandMark lang={lang} /></a>
          <nav className={menuOpen ? "is-open" : ""}>
            <a href="#venice" onClick={closeMenu}>{isZh ? "Venice AI" : "Venice AI"}</a>
            <a href="#vvv" onClick={closeMenu}>{isZh ? "为什么是 VVV" : "Why VVV"}</a>
            <a href="#diem" onClick={closeMenu}>DIEM</a>
            <a href="#ecosystem" onClick={closeMenu}>{isZh ? "生态架构" : "Ecosystem"}</a>
            <a href="#flywheel" onClick={closeMenu}>{isZh ? "增长飞轮" : "Growth"}</a>
            <a href="#roadmap" onClick={closeMenu}>{isZh ? "路线图" : "Roadmap"}</a>
          </nav>
          <div className="nav-actions">
            <div className="language-switch" aria-label={isZh ? "语言选择" : "Language selection"}>
              <button
                type="button"
                className={isZh ? "is-active" : ""}
                onClick={() => changeLanguage("zh")}
              >
                中文
              </button>
              <i />
              <button
                type="button"
                className={!isZh ? "is-active" : ""}
                onClick={() => changeLanguage("en")}
              >
                EN
              </button>
            </div>
            <a className="nav-launch" href="/stake">
              {isZh ? "进入质押大厅" : "Launch App"} <ArrowRight size={15} />
            </a>
            <button
              className="menu-toggle"
              type="button"
              aria-label={menuOpen ? (isZh ? "关闭菜单" : "Close menu") : (isZh ? "打开菜单" : "Open menu")}
              onClick={() => setMenuOpen((current) => !current)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section id="top" className="hero-section">
          <div className="hero-grid page-container">
            <div className="hero-copy">
              <div className="eyebrow-line">
                <span>{isZh ? "基于 BASE" : "BUILT ON BASE"}</span>
                <i />
                <span>{isZh ? "以 VVV 为核心" : "POWERED BY VVV"}</span>
                <i />
                <span>{isZh ? "由社区驱动" : "DRIVEN BY COMMUNITY"}</span>
              </div>
              <h1>
                {isZh ? "推动全球社区增长" : "Growing the Community"}
                <span>{isZh ? "共建 Venice AI 生态" : "Behind Venice AI"}</span>
              </h1>
              <div className="hero-identity">
                <span>VVVEco</span>
                <i />
                <p>{isZh ? "Venice AI 生态的社区增长层" : "The Community Growth Layer of Venice AI"}</p>
              </div>
              <p className="hero-lead">
                {isZh
                  ? "连接用户、开发者、AI Agents、建设者与全球社区，将 Venice AI 的基础设施价值转化为更广泛的生态参与和长期采用。"
                  : "Connecting users, developers, AI agents, builders and global communities to translate Venice AI infrastructure into broader participation and long-term adoption."}
              </p>
              <div className="hero-actions">
                <a className="button button-secondary" href="/whitepaper">
                  <BookOpen size={17} /> {isZh ? "查看白皮书" : "Read Whitepaper"}
                </a>
                <a className="button button-primary" href="/stake">
                  {isZh ? "进入质押大厅" : "Launch App"} <ArrowRight size={17} />
                </a>
              </div>
              <div className="hero-proof">
                <span><LockKeyhole size={15} /> {isZh ? "隐私优先 AI" : "Privacy-first AI"}</span>
                <span><Blocks size={15} /> {isZh ? "基于 Base" : "Built on Base"}</span>
                <span><Globe2 size={15} /> {isZh ? "社区驱动增长" : "Community-led growth"}</span>
              </div>
            </div>
            <HeroNetwork lang={lang} />
          </div>
          <div className="hero-footer page-container">
            <span>{isZh ? "01 / 探索生态" : "01 / DISCOVER THE ECOSYSTEM"}</span>
            <a href="#venice"><ArrowDown size={18} /></a>
          </div>
        </section>

        <Section
          id="venice"
          index="01"
          eyebrow={isZh ? "隐私智能基础设施" : "INTELLIGENCE INFRASTRUCTURE"}
          title={isZh ? <>什么是 <span>Venice AI？</span></> : <>What is <span>Venice AI?</span></>}
          description={
            <p>
              {isZh
                ? "Venice AI 是整个生态的价值源：一套面向用户、开发者和 AI Agents 的隐私 AI 基础设施，而不是另一个封闭式 AI 产品。"
                : "Venice AI is the source of value for the ecosystem: privacy-first AI infrastructure for users, developers and AI agents, rather than another closed AI product."}
            </p>
          }
        >
          <div className="venice-stack">
            <div className="stack-intro">
              <div className="stack-signal">
                <Radar size={20} />
                <span>{isZh ? "隐私智能网络" : "PRIVATE INTELLIGENCE NETWORK"}</span>
              </div>
              <h3>{isZh ? "开放访问隐私、去中心化的智能基础设施。" : "Open access to private, decentralized intelligence."}</h3>
              <p>
                {isZh
                  ? "Venice 将隐私保护、AI 推理访问与开放生态结合，为不同类型的参与者提供共同的智能基础设施。"
                  : "Venice combines privacy protection, AI inference access and an open ecosystem into shared intelligence infrastructure for every class of participant."}
              </p>
              <div className="stack-metrics">
                <div><strong>3</strong><span>{isZh ? "参与者类型" : "Participant classes"}</span></div>
                <div><strong>1</strong><span>{isZh ? "共享 AI 网络" : "Shared AI network"}</span></div>
                <div><strong>Base</strong><span>{isZh ? "链上结算生态" : "Settlement ecosystem"}</span></div>
              </div>
            </div>

            <div className="infrastructure-stack">
              <div className="stack-layer participant-layer">
                <div className="stack-label">{isZh ? "访问层" : "ACCESS LAYER"}</div>
                <div className="participant-grid">
                  <span><Users size={18} /> {isZh ? "用户" : "Users"}</span>
                  <span><Braces size={18} /> {isZh ? "开发者" : "Developers"}</span>
                  <span><Bot size={18} /> {isZh ? "AI 智能体" : "AI Agents"}</span>
                </div>
              </div>
              <div className="stack-connector"><i /><i /><i /></div>
              <div className="stack-layer inference-layer">
                <div className="stack-label">{isZh ? "隐私 AI 推理" : "PRIVATE AI INFERENCE"}</div>
                <div className="inference-pulse">
                  <span />
                  <strong>{isZh ? "智能访问" : "Intelligence Access"}</strong>
                  <small>{isZh ? "隐私 · 开放 · 效用" : "Privacy · Openness · Utility"}</small>
                </div>
              </div>
              <div className="stack-connector compact"><i /><i /><i /></div>
              <div className="stack-layer venice-layer">
                <div>
                  <span>{isZh ? "网络核心" : "NETWORK CORE"}</span>
                  <strong>VENICE AI</strong>
                </div>
                <div className="venice-wave"><i /><i /><i /><i /><i /></div>
              </div>
              <div className="stack-base">
                <span>{isZh ? "BASE 生态" : "BASE ECOSYSTEM"}</span>
                <span>{isZh ? "链上 · 可扩展 · 开放" : "ON-CHAIN · SCALABLE · OPEN"}</span>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="vvv"
          index="02"
          eyebrow={isZh ? "生态协调层" : "ECOSYSTEM COORDINATION"}
          title={isZh ? <>VVV 不只是<span>一个代币。</span></> : <>VVV is not <span>just a token.</span></>}
          description={
            <p>
              {isZh
                ? "VVV 是 Venice AI 生态中的访问、协调、参与、价值承载与社区共识层，它把技术网络连接到真正的生态活动。"
                : "VVV is the access, coordination, participation, value capture and alignment layer of Venice AI, connecting the technology network to real ecosystem activity."}
            </p>
          }
          className="vvv-section"
        >
          <VvvOrbit lang={lang} />
        </Section>

        <Section
          id="diem"
          index="03"
          eyebrow={isZh ? "AI 算力所有权" : "AI COMPUTE OWNERSHIP"}
          title={isZh ? <>DIEM 将 AI 访问转化为<span>可拥有的资源。</span></> : <>DIEM turns access into <span>an ownable resource.</span></>}
          description={
            <p>
              {isZh
                ? "VVV 负责协调生态，DIEM 将持续的 AI 计算访问转化为可拥有、可分配、可组合的链上资源。"
                : "VVV coordinates the ecosystem. DIEM transforms persistent AI compute access into an ownable, allocatable and composable on-chain resource."}
            </p>
          }
          className="diem-section"
        >
          <DiemBridge lang={lang} />
        </Section>

        <Section
          id="ecosystem"
          index="04"
          eyebrow={isZh ? "VENICE 生态架构" : "VENICE ECOSYSTEM MAP"}
          title={isZh ? <>一个生态，<span>六个连接层。</span></> : <>One ecosystem. <span>Six connected layers.</span></>}
          description={
            <p>
              {isZh
                ? "从 Base 到 Venice AI，从 VVV / DIEM 到 VVVEco、社区与全球采用。每一层承担不同职责，但共同形成一条完整的价值扩张路径。"
                : "From Base to Venice AI, from VVV and DIEM to VVVEco, community and global adoption. Each layer serves a distinct role in one complete path of value expansion."}
            </p>
          }
          className="map-section"
        >
          <EcosystemMap lang={lang} />
        </Section>

        <section className="why-section">
          <div className="page-container why-grid">
            <div className="why-statement">
              <div className="section-index">
                <span>05</span><i /><span>{isZh ? "为什么需要 VVVECO" : "WHY VVVECO EXISTS"}</span>
              </div>
              <h2>
                {isZh ? "技术创造" : "Technology creates"}
                <span>{isZh ? "可能性。" : "possibility."}</span>
                {isZh ? "社区创造" : "Communities create"}
                <span>{isZh ? "生态采用。" : "adoption."}</span>
              </h2>
            </div>
            <div className="why-body">
              <p className="why-lead">
                {isZh
                  ? "Venice AI 已经建立智能基础设施，VVV 已经建立生态协调基础。VVVEco 负责让这些价值被理解、被参与，并通过全球社区网络持续扩散。"
                  : "Venice AI has built the intelligence infrastructure. VVV provides the coordination foundation. VVVEco makes that value understood, participatory and continuously distributed through a global community network."}
              </p>
              <div className="why-lines">
                {(isZh
                  ? [
                      ["转化叙事", "将复杂技术转化为可信、可传播的社区叙事。"],
                      ["连接网络", "将用户、建设者、KOL 与区域社区连接成增长网络。"],
                      ["扩大采用", "让更多人从知道 Venice 走向使用、建设和支持 Venice。"],
                    ]
                  : [
                      ["TRANSLATE", "Translate complex technology into a credible and shareable community narrative."],
                      ["CONNECT", "Connect users, builders, KOLs and regional communities into a growth network."],
                      ["EXPAND", "Move more people from knowing Venice to using, building and supporting it."],
                    ]
                ).map(([label, copy], index) => (
                  <article key={label}>
                    <span>0{index + 1}</span>
                    <strong>{label}</strong>
                    <p>{copy}</p>
                    <ChevronRight size={18} />
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Section
          id="flywheel"
          index="06"
          eyebrow={isZh ? "社区增长飞轮" : "COMMUNITY GROWTH FLYWHEEL"}
          title={isZh ? <>由参与驱动的<span>生态增长。</span></> : <>Growth powered by <span>participation.</span></>}
          description={
            <p>
              {isZh
                ? "这不是收益循环，而是一条由教育、参与、社区增长、采用与 Venice 扩张共同推动的生态飞轮。"
                : "This is not a yield loop. It is an ecosystem flywheel powered by education, participation, community growth, adoption and Venice expansion."}
            </p>
          }
          className="flywheel-section"
        >
          <GrowthFlywheel lang={lang} />
        </Section>

        <Section
          id="community"
          index="07"
          eyebrow={isZh ? "VVVECO 社区架构" : "VVVECO COMMUNITY ARCHITECTURE"}
          title={isZh ? <>将信任转化为<span>生态采用的网络。</span></> : <>A network designed to <span>translate trust into adoption.</span></>}
          description={
            <p>
              {isZh
                ? "VVVEco 位于技术与全球社区之间，连接用户、KOL、社区大使、社区 Leader、开发者与合作伙伴。"
                : "VVVEco sits between technology and global communities, connecting users, KOLs, ambassadors, community leaders, developers and partners."}
            </p>
          }
          className="community-section"
        >
          <CommunityArchitecture lang={lang} />
        </Section>

        <Section
          index="08"
          eyebrow={isZh ? "核心能力" : "CORE CAPABILITIES"}
          title={isZh ? <>支撑社区扩张的<span>增长基础设施。</span></> : <>Infrastructure for <span>community expansion.</span></>}
          description={
            <p>
              {isZh
                ? "VVVEco 将长期参与、社区激活、网络扩张和链上透明组合成可持续的增长能力。"
                : "VVVEco combines long-term participation, community activation, network expansion and on-chain transparency into sustainable growth capabilities."}
            </p>
          }
        >
          <div className="capability-grid">
            {capabilities.map(({ number, icon: Icon, title, copy }) => (
              <article className="capability" key={title}>
                <div className="capability-head">
                  <span>{number}</span>
                  <Icon size={21} />
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
                <div className="capability-signal"><i /><i /><i /><i /></div>
              </article>
            ))}
          </div>
        </Section>

        <Section
          id="frontiers"
          index="09"
          eyebrow={isZh ? "下一代智能经济" : "THE NEXT INTELLIGENCE ECONOMY"}
          title={isZh ? <>AI 主权与<span>智能体经济汇合。</span></> : <>AI sovereignty meets the <span>agent economy.</span></>}
          description={
            <p>
              {isZh
                ? "隐私、AI 访问所有权和自主 Agent 正在汇合。VVVEco 的社区网络帮助这套新基础设施跨越认知与采用鸿沟。"
                : "Privacy, ownership of AI access and autonomous agents are converging. VVVEco helps this emerging infrastructure cross the gap between awareness and adoption."}
            </p>
          }
          className="frontier-section"
        >
          <FutureFrontiers lang={lang} />
        </Section>

        <Section
          id="roadmap"
          index="10"
          eyebrow={isZh ? "生态路线图" : "ECOSYSTEM ROADMAP"}
          title={isZh ? <>分阶段建设，<span>为长期生态而设计。</span></> : <>Built in phases. <span>Designed for the long term.</span></>}
          description={
            <p>
              {isZh
                ? "路线图围绕社区基础、全球增长、生态整合与长期共同建设推进，而不是围绕短期财务指标。"
                : "The roadmap advances through community foundations, global growth, ecosystem integration and long-term co-building, not short-term financial metrics."}
            </p>
          }
          className="roadmap-section"
        >
          <div className="roadmap-track">
            <div className="roadmap-line"><i /></div>
            {roadmap.map((phase, index) => (
              <article className={index === 0 ? "is-active" : ""} key={phase.title}>
                <div className="roadmap-node"><span>{phase.phase}</span></div>
                <div className="roadmap-meta">
                  <span>{isZh ? `阶段 ${phase.phase}` : `PHASE ${phase.phase}`}</span>
                  <small>{phase.status}</small>
                </div>
                <h3>{phase.title}</h3>
                <ul>
                  {phase.items.map((item) => (
                    <li key={item}><Check size={14} /> {item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Section>

        <section className="vision-section">
          <div className="vision-network" aria-hidden="true">
            {Array.from({ length: 34 }, (_, index) => (
              <i
                key={index}
                style={{
                  left: `${6 + ((index * 23) % 88)}%`,
                  top: `${10 + ((index * 37) % 78)}%`,
                  animationDelay: `${(index % 8) * 0.4}s`,
                }}
              />
            ))}
          </div>
          <div className="page-container vision-content">
            <div className="section-index">
              <span>11</span><i /><span>{isZh ? "长期愿景" : "LONG-TERM VISION"}</span>
            </div>
            <span className="vision-kicker">{isZh ? "全球社区增长网络" : "A GLOBAL COMMUNITY NETWORK"}</span>
            <h2>
              {isZh
                ? "建设推动 Venice AI 全球扩张的社区增长网络。"
                : "Building the community network behind the global expansion of Venice AI."}
            </h2>
            <p>
              {isZh
                ? "连接 VVV 持有者、AI 用户、开发者、KOL 与区域社区，共同推动隐私 AI 基础设施走向更广泛的理解、参与和采用。"
                : "Connecting VVV holders, AI users, developers, KOLs and regional communities to bring privacy-first AI infrastructure to broader understanding, participation and adoption."}
            </p>
          </div>
        </section>

        <section id="final-cta" className="final-cta">
          <div className="page-container cta-inner">
            <div className="cta-mark"><BrandMark compact lang={lang} /></div>
            <div>
              <span>{isZh ? "参与下一层生态建设" : "PARTICIPATE IN THE NEXT LAYER"}</span>
              <h2>{isZh ? "共同推动 Venice AI 生态增长。" : "Help grow the Venice AI ecosystem."}</h2>
              <p>{isZh ? "让基础设施价值走向全球社区与长期采用。" : "Bring infrastructure value to global communities and long-term adoption."}</p>
            </div>
            <div className="cta-actions">
              <a className="button button-primary" href="/stake">
                {isZh ? "进入质押大厅" : "Launch App"} <ArrowRight size={17} />
              </a>
              <a className="button button-secondary" href="/whitepaper">
                <BookOpen size={17} /> {isZh ? "查看白皮书" : "Read Whitepaper"}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="page-container footer-inner">
          <BrandMark lang={lang} />
          <p>{isZh ? "基于 Base · 以 VVV 为核心 · 由社区驱动" : "Built on Base · Powered by VVV · Driven by Community"}</p>
          <span>© 2026 VVVEco</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
