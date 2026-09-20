import type { ReactNode } from "react";
import styles from "./profile-boundary-state.module.css";

type ProfileBoundaryStateProps = {
  variant: "loading" | "error";
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function ProfileBoundaryState({
  variant,
  eyebrow,
  title,
  description,
  action,
}: ProfileBoundaryStateProps) {
  const isLoading = variant === "loading";

  return (
    <main
      className={styles.page}
      data-state={variant}
      data-scene-fallback="html"
      aria-busy={isLoading || undefined}
      aria-live={isLoading ? "polite" : undefined}
    >
      <div className="wb-shell-inner">
        <section className={styles.chamber} aria-labelledby={`profile-${variant}-title`}>
          <div className={styles.architecture} aria-hidden="true">
            <span className={styles.columnLeft} />
            <span className={styles.columnRight} />
            <span className={styles.ceilingRail} />
          </div>

          <div className={styles.vault} aria-hidden="true">
            <span className={styles.vaultOuter} />
            <span className={styles.vaultInner} />
            <span className={styles.vaultCore}>WB</span>
            {isLoading ? <span className={styles.scanLine} /> : <span className={styles.lockMark}>×</span>}
          </div>

          <div className={styles.copy}>
            <p className="wb-kicker">{eyebrow}</p>
            <h1 id={`profile-${variant}-title`}>{title}</h1>
            <p>{description}</p>
            <div className={styles.statusLine} role="status">
              <span aria-hidden="true" />
              {isLoading ? "Consulta segura em andamento" : "Fonte de perfil indisponível"}
            </div>
            {action ? <div className={styles.action}>{action}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
