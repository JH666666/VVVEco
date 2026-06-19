import type { EcosystemLanguage } from "./i18n";

export function VvvOrbit({ lang }: { lang: EcosystemLanguage }) {
  const roles = lang === "zh"
    ? [
        { code: "01", name: "AI 访问", detail: "连接智能需求与隐私 AI 推理基础设施。", angle: -90 },
        { code: "02", name: "生态协调", detail: "协调用户、建设者与生态参与者的长期方向。", angle: -18 },
        { code: "03", name: "生态参与", detail: "为使用、贡献和共同建设建立共享框架。", angle: 54 },
        { code: "04", name: "价值承载", detail: "将真实网络使用连接到可持续的生态价值。", angle: 126 },
        { code: "05", name: "社区共识", detail: "在全球社区中建立长期一致的目标与行动。", angle: 198 },
      ]
    : [
        { code: "01", name: "AI Access", detail: "Connect intelligence demand with private AI inference.", angle: -90 },
        { code: "02", name: "Coordination", detail: "Align users, builders and ecosystem participants.", angle: -18 },
        { code: "03", name: "Participation", detail: "Create a shared framework for use and contribution.", angle: 54 },
        { code: "04", name: "Value Capture", detail: "Connect network usage to sustainable ecosystem value.", angle: 126 },
        { code: "05", name: "Alignment", detail: "Build long-term direction across the community.", angle: 198 },
      ];

  return (
    <div className="vvv-system">
      <div className="vvv-orbit-visual">
        <div className="orbit-track orbit-track-outer" />
        <div className="orbit-track orbit-track-inner" />
        <div className="vvv-core">
          <span>{lang === "zh" ? "VENICE 生态" : "VENICE ECOSYSTEM"}</span>
          <strong>VVV</strong>
          <small>{lang === "zh" ? "生态协调层" : "COORDINATION LAYER"}</small>
        </div>
        {roles.map((role) => {
          const radians = (role.angle * Math.PI) / 180;
          const x = 50 + Math.cos(radians) * 42;
          const y = 50 + Math.sin(radians) * 42;
          return (
            <div
              className="orbit-role"
              key={role.name}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span>{role.code}</span>
              <strong>{role.name}</strong>
            </div>
          );
        })}
      </div>
      <div className="vvv-role-list">
        {roles.map((role) => (
          <article key={role.name}>
            <span>{role.code}</span>
            <div>
              <h3>{lang === "zh" ? role.name : `${role.name} Layer`}</h3>
              <p>{role.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
