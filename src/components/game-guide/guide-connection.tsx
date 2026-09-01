import type { ReactNode } from "react";

export type GuideConnectionVariant =
  | "normal"
  | "barrier"
  | "tunnel"
  | "blocked";

const markerByVariant: Partial<Record<GuideConnectionVariant, string>> = {
  barrier: "▣",
  blocked: "×",
};

export function GuideConnection({
  from,
  to,
  variant = "normal",
  directed = false,
  ariaLabel,
  caption,
  className = "",
}: {
  from: ReactNode;
  to: ReactNode;
  variant?: GuideConnectionVariant;
  directed?: boolean;
  ariaLabel: string;
  caption?: ReactNode;
  className?: string;
}) {
  const marker = markerByVariant[variant];

  return (
    <figure className={`wb-guide-connection ${className}`.trim()}>
      <div
        className={`wb-guide-connection-track ${directed ? "wb-guide-connection-track--directed" : ""}`.trim()}
        data-variant={variant}
        role="img"
        aria-label={ariaLabel}
      >
        <div className="wb-guide-connection-endpoint" aria-hidden="true">
          {from}
        </div>
        <div className="wb-guide-connection-line" aria-hidden="true">
          {marker ? <span>{marker}</span> : null}
        </div>
        <div className="wb-guide-connection-endpoint" aria-hidden="true">
          {to}
        </div>
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
