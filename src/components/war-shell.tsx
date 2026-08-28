import Link from "next/link";
import type { ReactNode } from "react";

type WarShellProps = {
  children: ReactNode;
  title?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  immersive?: boolean;
};

export function WarShell({
  children,
  title,
  backHref,
  backLabel = "Voltar",
  actions,
  immersive = false,
}: WarShellProps) {
  return (
    <div className="wb-shell">
      <header className="wb-header">
        <div className="wb-shell-inner wb-header-inner">
          <div>
            {backHref ? (
              <Link href={backHref} className="wb-back">
                <span aria-hidden="true">←</span>
                {backLabel}
              </Link>
            ) : (
              <Link href="/" className="wb-brand" aria-label="WAR Brasil — início">
                <span className="wb-brand-mark" aria-hidden="true">
                  <span>W</span>
                </span>
                <span className="wb-brand-copy">
                  WAR <strong>BRASIL</strong>
                </span>
              </Link>
            )}
          </div>

          <div className="wb-header-title" aria-current={title ? "page" : undefined}>
            {title ?? (immersive ? "Estratégia em território nacional" : "")}
          </div>

          <div className="wb-header-actions">
            {actions}
            {!actions && !immersive ? (
              <Link href="/matchmaking" className="wb-ghost-link">
                Salas
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
