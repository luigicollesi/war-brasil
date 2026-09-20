import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./legal-document.module.css";

export type LegalSection = Readonly<{
  title: string;
  summary?: string;
  content: ReactNode;
}>;

type LegalHighlight = Readonly<{
  label: string;
  value: string;
}>;

function sectionId(index: number) {
  return `secao-${String(index + 1).padStart(2, "0")}`;
}

export function LegalDocument({
  eyebrow,
  title,
  lead,
  updatedAt,
  highlights = [],
  sections,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  updatedAt: string;
  highlights?: ReadonlyArray<LegalHighlight>;
  sections: ReadonlyArray<LegalSection>;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topline} aria-label="Navegação legal">
          <Link href="/" className={styles.brand}>
            Bellum Civile
          </Link>

          <div className={styles.documentLinks}>
            <Link href="/terms">Termos</Link>
            <Link href="/privacy">Privacidade</Link>
            <Link href="/" className={styles.back}>
              ← Home
            </Link>
          </div>
        </nav>

        <header className={styles.header}>
          <p className={styles.kicker}>{eyebrow}</p>
          <h1>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          <small className={styles.updated}>Última atualização // {updatedAt}</small>
        </header>

        {highlights.length > 0 ? (
          <section className={styles.highlights} aria-label="Resumo do documento">
            {highlights.map((highlight) => (
              <div className={styles.highlight} key={highlight.label}>
                <span>{highlight.label}</span>
                <strong>{highlight.value}</strong>
              </div>
            ))}
          </section>
        ) : null}

        <div className={styles.documentGrid}>
          <aside className={styles.index}>
            <span className={styles.indexLabel}>Neste documento</span>
            <nav aria-label="Índice do documento">
              {sections.map((section, index) => (
                <a href={`#${sectionId(index)}`} key={section.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <article className={styles.content}>
            {sections.map((section, index) => (
              <section
                className={styles.section}
                id={sectionId(index)}
                key={section.title}
              >
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionNumber}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2>{section.title}</h2>
                    {section.summary ? (
                      <p className={styles.sectionSummary}>{section.summary}</p>
                    ) : null}
                  </div>
                </div>

                <div className={styles.sectionBody}>{section.content}</div>
              </section>
            ))}
          </article>
        </div>

        <footer className={styles.footer}>
          <span>Bellum Civile // Brasil</span>
          <Link href="/terms">Termos de Uso</Link>
          <Link href="/privacy">Política de Privacidade</Link>
          <Link href="/">Home</Link>
        </footer>
      </div>
    </main>
  );
}
