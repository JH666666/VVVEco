import type { EcosystemLanguage } from "./i18n";

export function HeroNetwork({ lang }: { lang: EcosystemLanguage }) {
  const satellites = [
    { label: lang === "zh" ? "用户" : "USERS", x: 17, y: 22 },
    { label: lang === "zh" ? "开发者" : "DEVELOPERS", x: 80, y: 18 },
    { label: lang === "zh" ? "AI 智能体" : "AI AGENTS", x: 88, y: 57 },
    { label: lang === "zh" ? "建设者" : "BUILDERS", x: 68, y: 85 },
    { label: lang === "zh" ? "全球社区" : "COMMUNITIES", x: 18, y: 76 },
  ];

  return (
    <div
      className="hero-network"
      aria-label={lang === "zh" ? "Venice AI 生态网络" : "Venice AI ecosystem network"}
    >
      <div className="network-grid" />
      <svg className="network-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGradient" x1="0" x2="1">
            <stop offset="0" stopColor="#007277" stopOpacity=".08" />
            <stop offset=".5" stopColor="#143C62" stopOpacity=".9" />
            <stop offset="1" stopColor="#BD6700" stopOpacity=".12" />
          </linearGradient>
          <radialGradient id="coreGlow">
            <stop offset="0" stopColor="#F5F1EA" stopOpacity=".95" />
            <stop offset=".22" stopColor="#007277" stopOpacity=".8" />
            <stop offset=".72" stopColor="#143C62" stopOpacity=".16" />
            <stop offset="1" stopColor="#143C62" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="38" className="orbit orbit-one" />
        <circle cx="50" cy="50" r="25" className="orbit orbit-two" />
        <circle cx="50" cy="50" r="13" className="orbit orbit-three" />
        {satellites.map((node) => (
          <line
            key={node.label}
            x1="50"
            y1="50"
            x2={node.x}
            y2={node.y}
            stroke="url(#lineGradient)"
            strokeWidth=".3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle cx="50" cy="50" r="25" fill="url(#coreGlow)" opacity=".58" />
      </svg>

      <div className="network-core">
        <span className="core-overline">{lang === "zh" ? "生态协调核心" : "ECOSYSTEM CORE"}</span>
        <strong>VVV</strong>
        <small>{lang === "zh" ? "访问 · 协调 · 参与" : "Access · Coordinate · Participate"}</small>
      </div>

      <div className="venice-node">
        <span>{lang === "zh" ? "隐私智能基础设施" : "INTELLIGENCE INFRASTRUCTURE"}</span>
        <strong>VENICE AI</strong>
      </div>

      {satellites.map((node, index) => (
        <div
          key={node.label}
          className="satellite-node"
          style={{ left: `${node.x}%`, top: `${node.y}%`, "--delay": `${index * 0.35}s` } as React.CSSProperties}
        >
          <i />
          <span>{node.label}</span>
        </div>
      ))}

      <div className="growth-ring">
        <span>{lang === "zh" ? "VVVECO · 全球社区增长网络 · " : "VVVECO · COMMUNITY GROWTH NETWORK · "}</span>
      </div>

      <div className="network-status">
        <span><i /> {lang === "zh" ? "网络运行中" : "NETWORK ACTIVE"}</span>
        <span>BASE / 8453</span>
      </div>
    </div>
  );
}
