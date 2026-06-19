import type { ReactNode } from "react";

type SectionProps = {
  id?: string;
  index: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Section({
  id,
  index,
  eyebrow,
  title,
  description,
  children,
  className = "",
}: SectionProps) {
  return (
    <section id={id} className={`section-shell ${className}`}>
      <div className="page-container">
        <div className="section-heading">
          <div className="section-index">
            <span>{index}</span>
            <i />
            <span>{eyebrow}</span>
          </div>
          <div className="section-title-row">
            <h2>{title}</h2>
            {description && <div className="section-description">{description}</div>}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}
