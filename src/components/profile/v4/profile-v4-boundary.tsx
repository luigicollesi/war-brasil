import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./profile-v4-boundary.module.css";

export function ProfileV4Boundary({
  variant,
  eyebrow,
  title,
  description,
  action,
}: {
  variant: "loading" | "error";
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <main className={styles.page} data-profile-v4-boundary={variant}>
      <header className={styles.commandBar}>
        <Link href="/home" className={styles.homeLink} aria-label="Voltar ao comando">
          <svg
            className={styles.homeIcon}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M14.5 5.5 8 12l6.5 6.5M8.5 12H19" />
          </svg>
        </Link>
        <span className={styles.commandCopy}>
          <small>QUARTEL DO COMANDANTE</small>
          <strong>{variant === "loading" ? "SINCRONIZANDO" : "ACESSO PARCIAL"}</strong>
        </span>
        <span className={styles.walletPlaceholder} aria-label="Créditos de Campanha indisponíveis durante a sincronização">
          <Image src="/coin.svg" alt="" width={28} height={28} aria-hidden="true" />
          <strong>—</strong>
        </span>
      </header>

      <section className={styles.state} aria-live={variant === "loading" ? "polite" : undefined}>
        <span className={styles.code}>{eyebrow}</span>
        <div className={styles.signal} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
        {action ? <div className={styles.actions}>{action}</div> : null}
      </section>
    </main>
  );
}
