import type { ReactNode } from "react";

export function GuideStateChange({
  before,
  action,
  after,
  ariaLabel,
  beforeLabel = "Antes",
  afterLabel = "Depois",
  caption,
  className = "",
}: {
  before: ReactNode;
  action: ReactNode;
  after: ReactNode;
  ariaLabel: string;
  beforeLabel?: ReactNode;
  afterLabel?: ReactNode;
  caption?: ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={`wb-guide-state-change ${className}`.trim()}
      aria-label={ariaLabel}
    >
      <div className="wb-guide-state-change-stage">
        <span>{beforeLabel}</span>
        <div>{before}</div>
      </div>

      <div className="wb-guide-state-change-action">
        <span aria-hidden="true">→</span>
        <strong>{action}</strong>
        <span aria-hidden="true">→</span>
      </div>

      <div className="wb-guide-state-change-stage">
        <span>{afterLabel}</span>
        <div>{after}</div>
      </div>

      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
