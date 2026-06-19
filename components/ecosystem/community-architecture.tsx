import type { EcosystemLanguage } from "./i18n";

export function CommunityArchitecture({ lang }: { lang: EcosystemLanguage }) {
  const participants = [
    { code: "01", label: lang === "zh" ? "用户" : "Users", x: 50, y: 4 },
    { code: "02", label: "KOLs", x: 87, y: 25 },
    { code: "03", label: lang === "zh" ? "社区大使" : "Ambassadors", x: 87, y: 72 },
    { code: "04", label: lang === "zh" ? "合作伙伴" : "Partners", x: 50, y: 94 },
    { code: "05", label: lang === "zh" ? "开发者" : "Developers", x: 13, y: 72 },
    { code: "06", label: lang === "zh" ? "社区 Leader" : "Community Leaders", x: 13, y: 25 },
  ];

  return (
    <div className="community-composition">
      <div className="community-network" aria-label="VVVEco community architecture">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="38" />
          <circle cx="50" cy="50" r="24" />
          {participants.map((participant) => (
            <line
              key={participant.label}
              x1="50"
              y1="50"
              x2={participant.x}
              y2={participant.y}
            />
          ))}
        </svg>
        <div className="community-core">
          <span>{lang === "zh" ? "社区增长层" : "COMMUNITY GROWTH LAYER"}</span>
          <strong>VVVEco</strong>
          <small>{lang === "zh" ? "组织 · 教育 · 扩张" : "ORGANIZE · EDUCATE · EXPAND"}</small>
        </div>
        {participants.map((participant) => (
          <div
            className="community-node"
            key={participant.label}
            style={{ left: `${participant.x}%`, top: `${participant.y}%` }}
          >
            <i>{participant.code}</i>
            <span>{participant.label}</span>
          </div>
        ))}
      </div>
      <div className="community-copy">
        <span className="community-kicker">{lang === "zh" ? "分布式信任网络" : "A DISTRIBUTED TRUST NETWORK"}</span>
        <h3>{lang === "zh" ? "一个增长层，多种参与角色。" : "One growth layer. Many participation roles."}</h3>
        <p>
          {lang === "zh"
            ? "VVVEco 不是单一渠道，而是一套连接教育、内容、建设、区域组织和生态合作的社区架构。每一种角色都把 Venice AI 的基础设施价值带向新的用户与使用场景。"
            : "VVVEco is not a single channel. It is a community architecture connecting education, content, building, regional organization and ecosystem collaboration. Every role carries Venice AI infrastructure into new audiences and use cases."}
        </p>
        <div className="community-principles">
          <div><span>01</span><strong>{lang === "zh" ? "本地信任" : "Local trust"}</strong><p>{lang === "zh" ? "由熟悉当地语言和文化的节点建立理解与信任。" : "Build understanding and trust through people who know local language and culture."}</p></div>
          <div><span>02</span><strong>{lang === "zh" ? "共同叙事" : "Shared narrative"}</strong><p>{lang === "zh" ? "围绕 AI 主权、隐私和所有权形成一致的长期叙事。" : "Align around a long-term narrative of AI sovereignty, privacy and ownership."}</p></div>
          <div><span>03</span><strong>{lang === "zh" ? "可衡量扩张" : "Measurable expansion"}</strong><p>{lang === "zh" ? "将教育和参与转化为可持续的社区与生态采用。" : "Turn education and participation into sustainable community and ecosystem adoption."}</p></div>
        </div>
      </div>
    </div>
  );
}
