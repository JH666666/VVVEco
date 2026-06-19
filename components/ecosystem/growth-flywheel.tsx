import type { EcosystemLanguage } from "./i18n";

export function GrowthFlywheel({ lang }: { lang: EcosystemLanguage }) {
  const stages = [
    { number: "01", label: lang === "zh" ? "生态教育" : "Education", x: 50, y: 5 },
    { number: "02", label: lang === "zh" ? "参与" : "Participation", x: 91, y: 35 },
    { number: "03", label: lang === "zh" ? "社区增长" : "Community Growth", x: 75, y: 84 },
    { number: "04", label: lang === "zh" ? "生态采用" : "Adoption", x: 25, y: 84 },
    { number: "05", label: lang === "zh" ? "Venice 扩张" : "Venice Expansion", x: 9, y: 35 },
  ];
  const notes = lang === "zh"
    ? [
        ["生态教育", "让 Venice AI、VVV 与 DIEM 被清晰、可信地理解。"],
        ["生态参与", "用户、建设者和社区 Leader 进入生态并开始贡献。"],
        ["社区增长", "内容、KOL 与区域网络持续扩大生态触达。"],
        ["生态采用", "更多人开始使用、持有并建设 Venice 生态。"],
        ["Venice 扩张", "新的使用与共识开启下一轮生态教育。"],
      ]
    : [
        ["Education", "Venice AI, VVV and DIEM become clear, credible and understood."],
        ["Participation", "Users, builders and community leaders enter the ecosystem."],
        ["Community Growth", "Content, KOLs and regional networks extend reach."],
        ["Adoption", "More people use, hold and build within the Venice ecosystem."],
        ["Venice Expansion", "New usage and alignment create the next education cycle."],
      ];

  return (
    <div className="flywheel-composition">
      <div className="flywheel">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="flywheelGradient" x1=".1" y1=".1" x2=".9" y2=".9">
              <stop offset="0" stopColor="#007277" />
              <stop offset=".55" stopColor="#143C62" />
              <stop offset="1" stopColor="#BD6700" />
            </linearGradient>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#007277" />
            </marker>
          </defs>
          <circle cx="50" cy="50" r="34" className="flywheel-track" />
          <circle cx="50" cy="50" r="41" className="flywheel-dash" />
          <path d="M50 12 A38 38 0 0 1 86 38" className="flywheel-arc arc-one" markerEnd="url(#arrow)" />
          <path d="M88 45 A38 38 0 0 1 69 84" className="flywheel-arc arc-two" markerEnd="url(#arrow)" />
          <path d="M63 87 A38 38 0 0 1 24 78" className="flywheel-arc arc-three" markerEnd="url(#arrow)" />
          <path d="M19 72 A38 38 0 0 1 18 31" className="flywheel-arc arc-four" markerEnd="url(#arrow)" />
          <path d="M22 25 A38 38 0 0 1 44 13" className="flywheel-arc arc-five" markerEnd="url(#arrow)" />
        </svg>
        <div className="flywheel-core">
          <span>VENICE AI</span>
          <strong>{lang === "zh" ? <>生态<br />增长</> : <>ECOSYSTEM<br />GROWTH</>}</strong>
          <small>{lang === "zh" ? "社区驱动" : "COMMUNITY-LED"}</small>
        </div>
        {stages.map((stage) => (
          <div
            className="flywheel-stage"
            key={stage.label}
            style={{ left: `${stage.x}%`, top: `${stage.y}%` }}
          >
            <i>{stage.number}</i>
            <span>{stage.label}</span>
          </div>
        ))}
      </div>
      <div className="flywheel-notes">
        {notes.map(([title, copy], index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
