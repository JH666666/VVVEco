import { Bot, Fingerprint, Orbit } from "lucide-react";
import type { EcosystemLanguage } from "./i18n";

export function FutureFrontiers({ lang }: { lang: EcosystemLanguage }) {
  const frontiers = lang === "zh"
    ? [
        { icon: Fingerprint, label: "AI 主权", title: "智能应当属于使用它的人。", copy: "隐私不是附加功能，而是数字自主权的基础。Venice 让用户在使用先进 AI 时保留数据主权与选择权。" },
        { icon: Bot, label: "智能体经济", title: "自主 Agent 需要自主的算力访问。", copy: "Agent 需要持续、可编程、无需人工干预的推理访问。VVV 与 DIEM 为机器经济提供原生的协调和资源层。" },
        { icon: Orbit, label: "为什么是现在", title: "隐私、所有权与 Agent 正在汇合。", copy: "AI 普及、数据主权意识和 Agent 经济在同一时间加速。社区增长层决定这些基础设施能否真正走向全球采用。" },
      ]
    : [
        { icon: Fingerprint, label: "AI SOVEREIGNTY", title: "Intelligence should belong to the people who use it.", copy: "Privacy is not an add-on. It is the foundation of digital sovereignty. Venice lets people retain data ownership and choice while using advanced AI." },
        { icon: Bot, label: "AGENT ECONOMY", title: "Autonomous agents need autonomous access to compute.", copy: "Agents need persistent, programmable inference without human intervention. VVV and DIEM provide native coordination and resource layers for the machine economy." },
        { icon: Orbit, label: "WHY NOW", title: "Privacy, ownership and agents are converging.", copy: "AI adoption, data sovereignty and the agent economy are accelerating together. The community growth layer determines whether this infrastructure reaches global adoption." },
      ];

  return (
    <div className="frontier-grid">
      {frontiers.map(({ icon: Icon, label, title, copy }, index) => (
        <article key={label}>
          <div className="frontier-meta">
            <span>0{index + 1}</span>
            <Icon size={22} />
          </div>
          <small>{label}</small>
          <h3>{title}</h3>
          <p>{copy}</p>
          <div className="frontier-line"><i /></div>
        </article>
      ))}
    </div>
  );
}
