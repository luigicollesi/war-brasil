import type { ReactNode } from "react";

export type GuideRuleScaleTone =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "muted";

export type GuideRuleScaleItem = {
  key: string;
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: GuideRuleScaleTone;
};

export function GuideRuleScale({
  items,
  ariaLabel,
  className = "",
}: {
  items: readonly GuideRuleScaleItem[];
  ariaLabel: string;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <dl className={`wb-guide-rule-scale ${className}`.trim()} aria-label={ariaLabel}>
      {items.map((item) => (
        <div key={item.key} data-tone={item.tone ?? "default"}>
          <dt>{item.label}</dt>
          <dd>
            <div className="wb-guide-rule-scale-value">{item.value}</div>
            {item.detail ? <small>{item.detail}</small> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
