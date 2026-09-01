import type { CSSProperties, ReactNode } from "react";

export type GuideFlowTone =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "muted";

export type GuideFlowStep = {
  key: string;
  label: ReactNode;
  eyebrow?: ReactNode;
  detail?: ReactNode;
  tone?: GuideFlowTone;
};

export function GuideFlow({
  steps,
  ariaLabel,
  compact = false,
  className = "",
}: {
  steps: readonly GuideFlowStep[];
  ariaLabel: string;
  compact?: boolean;
  className?: string;
}) {
  if (steps.length === 0) return null;

  return (
    <ol
      className={`wb-guide-flow ${compact ? "wb-guide-flow--compact" : ""} ${className}`.trim()}
      aria-label={ariaLabel}
      style={{ "--wb-guide-flow-count": steps.length } as CSSProperties}
    >
      {steps.map((step) => (
        <li key={step.key} data-tone={step.tone ?? "default"}>
          {step.eyebrow ? (
            <span className="wb-guide-flow-eyebrow">{step.eyebrow}</span>
          ) : null}
          <strong>{step.label}</strong>
          {step.detail ? <small>{step.detail}</small> : null}
        </li>
      ))}
    </ol>
  );
}
