import type { EcosystemLanguage } from "./i18n";
import { OfficialLogo } from "@/components/brand/official-logo";

export function BrandMark({
  compact = false,
  lang = "en",
}: {
  compact?: boolean;
  lang?: EcosystemLanguage;
}) {
  return (
    <div className="brand-mark" aria-label="VVVEco">
      <OfficialLogo size={compact ? 42 : 38} />
      {!compact && (
        <span>
          <strong>VVVEco</strong>
          <small>{lang === "zh" ? "Venice AI 社区增长层" : "Community Growth Layer"}</small>
        </span>
      )}
    </div>
  );
}
