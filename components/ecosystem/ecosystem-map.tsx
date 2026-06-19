import type { EcosystemLanguage } from "./i18n";

export function EcosystemMap({ lang }: { lang: EcosystemLanguage }) {
  const layers = lang === "zh"
    ? [
        { label: "生态采用层", title: "全球生态扩张", items: ["认知", "使用", "合作", "网络效应"], tone: "mint" },
        { label: "社区网络", title: "全球社区", items: ["用户", "KOL", "大使", "社区 Leader"], tone: "cyan" },
        { label: "社区增长层", title: "VVVEco", items: ["教育", "参与", "扩张", "共识"], tone: "gold" },
        { label: "协调与效用层", title: "VVV / DIEM", items: ["访问", "协调", "AI 算力", "价值承载"], tone: "base" },
        { label: "AI 基础设施层", title: "Venice AI", items: ["隐私推理", "开发者", "用户", "AI 智能体"], tone: "signal" },
        { label: "结算层", title: "Base", items: ["可扩展", "可验证", "链上", "开放"], tone: "dim" },
      ]
    : [
        { label: "ADOPTION LAYER", title: "Global Ecosystem Expansion", items: ["Awareness", "Usage", "Partnerships", "Network Effects"], tone: "mint" },
        { label: "COMMUNITY NETWORK", title: "Community", items: ["Users", "KOLs", "Ambassadors", "Leaders"], tone: "cyan" },
        { label: "COMMUNITY GROWTH LAYER", title: "VVVEco", items: ["Education", "Participation", "Expansion", "Alignment"], tone: "gold" },
        { label: "COORDINATION & UTILITY", title: "VVV / DIEM", items: ["Access", "Coordination", "AI Compute", "Value Capture"], tone: "base" },
        { label: "AI INFRASTRUCTURE LAYER", title: "Venice AI", items: ["Private Inference", "Developers", "Users", "AI Agents"], tone: "signal" },
        { label: "SETTLEMENT LAYER", title: "Base", items: ["Scalable", "Verifiable", "On-chain", "Open"], tone: "dim" },
      ];

  return (
    <div className="ecosystem-map">
      <div className="map-axis">
        <span>{lang === "zh" ? "价值创造" : "VALUE CREATION"}</span>
        <i />
        <span>{lang === "zh" ? "采用扩张" : "ADOPTION EXPANSION"}</span>
      </div>
      <div className="map-layers">
        {layers.map((layer, index) => (
          <div className={`map-layer tone-${layer.tone}`} key={layer.title}>
            <div className="layer-sequence">0{layers.length - index}</div>
            <div className="layer-id">{layer.label}</div>
            <h3>{layer.title}</h3>
            <div className="layer-items">
              {layer.items.map((item) => <span key={item}>{item}</span>)}
            </div>
            <div className="layer-signal" />
          </div>
        ))}
      </div>
      <div className="map-caption">
        <strong>{lang === "zh" ? "一个完整连接的生态系统" : "ONE CONNECTED ECOSYSTEM"}</strong>
        <span>
          {lang === "zh"
            ? "基础设施创造价值，社区将价值转化为采用。"
            : "Infrastructure creates value. Community turns value into adoption."}
        </span>
      </div>
    </div>
  );
}
