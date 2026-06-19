import { Bot, Cpu, KeyRound, Repeat2 } from "lucide-react";
import type { EcosystemLanguage } from "./i18n";

export function DiemBridge({ lang }: { lang: EcosystemLanguage }) {
  const diemRoles = lang === "zh"
    ? [
        { icon: KeyRound, label: "所有权", title: "让 AI 访问成为可拥有的资源", copy: "DIEM 将持续的 AI 访问能力从订阅租约转化为可拥有、可组合的链上资源。" },
        { icon: Cpu, label: "算力", title: "持续存在的智能预算", copy: "每个 DIEM 连接可持续的 AI 计算额度，为用户、开发者和组织提供可预测的访问基础。" },
        { icon: Bot, label: "智能体", title: "面向 Agent 的原生基础设施", copy: "AI Agents 可以围绕 DIEM 管理计算预算、访问推理服务，并参与开放的机器经济。" },
        { icon: Repeat2, label: "经济层", title: "VVV 将生态价值连接到真实效用", copy: "VVV 是上游协调层，DIEM 是可使用的算力资产，两者共同连接 Venice 的真实需求与生态价值。" },
      ]
    : [
        { icon: KeyRound, label: "OWNERSHIP", title: "AI access becomes ownable", copy: "DIEM transforms persistent AI access from a rented subscription into an ownable and composable on-chain resource." },
        { icon: Cpu, label: "COMPUTE", title: "A persistent intelligence budget", copy: "Each DIEM connects to ongoing AI compute capacity, creating predictable access for users, developers and organizations." },
        { icon: Bot, label: "AGENTS", title: "Native infrastructure for agents", copy: "AI agents can use DIEM to manage compute budgets, access inference and participate in an open machine economy." },
        { icon: Repeat2, label: "ECONOMY", title: "VVV connects value to utility", copy: "VVV coordinates the ecosystem while DIEM provides usable compute assets, linking real Venice demand to ecosystem value." },
      ];

  return (
    <div className="diem-composition">
      <div className="diem-bridge" aria-label={lang === "zh" ? "VVV 至 DIEM 效用桥梁" : "VVV to DIEM utility bridge"}>
        <div className="diem-origin">
          <span>{lang === "zh" ? "生态协调" : "COORDINATION"}</span>
          <strong>VVV</strong>
          <small>{lang === "zh" ? "参与 · 共识 · 创造" : "Stake · Align · Create"}</small>
        </div>
        <div className="diem-flow">
          <i />
          <span>{lang === "zh" ? "效用转化" : "UTILITY TRANSFORMATION"}</span>
          <i />
        </div>
        <div className="diem-asset">
          <span>{lang === "zh" ? "AI 算力资产" : "AI COMPUTE ASSET"}</span>
          <strong>DIEM</strong>
          <small>{lang === "zh" ? "拥有 · 使用 · 分配" : "Own · Use · Allocate"}</small>
        </div>
      </div>
      <div className="diem-role-grid">
        {diemRoles.map(({ icon: Icon, label, title, copy }, index) => (
          <article key={title}>
            <div>
              <span>0{index + 1} / {label}</span>
              <Icon size={19} />
            </div>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
