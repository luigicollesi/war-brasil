import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./legal-document.module.css";

export type LegalSection = Readonly<{
  title: string;
  content: ReactNode;
}>;

export function LegalDocument({
  eyebrow,
  title,
  lead,
  updatedAt,
  sections,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  updatedAt: string;
  sections: ReadonlyArray<LegalSection>;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topline} aria-label="Navegação legal">
          <Link href="/" className={styles.brand}>
            Bellum Civile
          </Link>
          <Link href="/" className={styles.back}>
            ← Voltar à Home
          </Link>
        </nav>

        <header className={styles.header}>
          <p className={styles.kicker}>{eyebrow}</p>
          <h1>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          <small className={styles.updated}>Atualizado em {updatedAt}</small>
        </header>

        <div className={styles.content}>
          {sections.map((section, index) => (
            <section className={styles.section} key={section.title}>
              <span className={styles.sectionNumber}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className={styles.sectionBody}>
                <h2>{section.title}</h2>
                {section.content}
              </div>
            </section>
          ))}
        </div>

        <footer className={styles.footer}>
          <span>Bellum Civile // Brasil</span>
          <Link href="/terms">Termos de Uso</Link>
          <Link href="/privacy">Política de Privacidade</Link>
        </footer>
      </div>
    </main>
  );
}
