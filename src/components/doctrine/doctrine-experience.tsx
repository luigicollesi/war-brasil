"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { DoctrineChapterDemo } from "@/src/components/doctrine/doctrine-demo";
import {
  isDoctrineChapterSlug,
  type DoctrineChapter,
  type DoctrineChapterSlug,
  type DoctrinePresentation,
} from "@/src/lib/doctrine-presentation";
import integration from "./doctrine-foundation-integration.module.css";
import styles from "./doctrine-experience.module.css";

function chapterHref(slug: DoctrineChapterSlug) {
  return `/rules?chapter=${slug}`;
}

function shouldUseNativeNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function DoctrineMetrics({ chapter }: { chapter: DoctrineChapter }) {
  return (
    <dl className={styles.metrics} aria-label={`Dados-chave de ${chapter.title}`}>
      {chapter.metrics.map((metric) => (
        <div key={`${chapter.slug}-${metric.label}`} className={styles.metric}>
          <dt>{metric.label}</dt>
          <dd>{metric.value}</dd>
          {metric.detail ? <p>{metric.detail}</p> : null}
        </div>
      ))}
    </dl>
  );
}

export function DoctrineExperience({
  presentation,
  initialChapter,
}: {
  presentation: DoctrinePresentation;
  initialChapter: DoctrineChapterSlug;
}) {
  const [activeSlug, setActiveSlug] = useState<DoctrineChapterSlug>(initialChapter);
  const activeIndex = useMemo(
    () => presentation.chapters.findIndex((chapter) => chapter.slug === activeSlug),
    [activeSlug, presentation.chapters],
  );
  const activeChapter = presentation.chapters[activeIndex] ?? presentation.chapters[0];
  const previousChapter = activeIndex > 0 ? presentation.chapters[activeIndex - 1] : null;
  const nextChapter =
    activeIndex >= 0 && activeIndex < presentation.chapters.length - 1
      ? presentation.chapters[activeIndex + 1]
      : null;

  useEffect(() => {
    const onPopState = () => {
      const slug = new URLSearchParams(window.location.search).get("chapter");
      setActiveSlug(
        isDoctrineChapterSlug(slug) ? slug : presentation.chapters[0].slug,
      );
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [presentation.chapters]);

  function selectChapter(
    event: MouseEvent<HTMLAnchorElement>,
    slug: DoctrineChapterSlug,
  ) {
    if (shouldUseNativeNavigation(event)) return;
    event.preventDefault();
    if (slug === activeSlug) return;

    window.history.pushState({ chapter: slug }, "", chapterHref(slug));
    setActiveSlug(slug);
  }

  return (
    <main
      className={`${styles.page} ${integration.foundationIntegrated}`}
      data-doctrine-chapter={activeChapter.slug}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Capítulo {activeChapter.number}: {activeChapter.title}
      </p>
      <div className={styles.ambientGrid} aria-hidden="true" />

      <div className={styles.shell}>
        <aside className={styles.indexPanel} aria-labelledby="doctrine-index-title">
          <div className={styles.indexHeader}>
            <span>WB / DTR</span>
            <small>
              {String(presentation.chapters.length).padStart(2, "0")} REGISTROS
            </small>
          </div>
          <h1 id="doctrine-index-title">DOUTRINA</h1>
          <p>
            Protocolos operacionais para compreender a máquina antes de entrar em
            combate.
          </p>

          <nav className={styles.chapterNav} aria-label="Capítulos da Doutrina">
            {presentation.chapters.map((chapter) => {
              const active = chapter.slug === activeChapter.slug;
              return (
                <Link
                  key={chapter.slug}
                  href={chapterHref(chapter.slug)}
                  onClick={(event) => selectChapter(event, chapter.slug)}
                  aria-current={active ? "location" : undefined}
                  data-active={active ? "true" : "false"}
                  prefetch={false}
                  scroll={false}
                >
                  <span>{chapter.number}</span>
                  <b>{chapter.eyebrow}</b>
                  <i aria-hidden="true" />
                </Link>
              );
            })}
          </nav>

          <div className={styles.indexFooter}>
            <span>LEITURA AUTORIZADA</span>
            <small>Sem dados privados da partida</small>
          </div>
        </aside>

        <section className={styles.content} aria-labelledby="chapter-title">
          <header className={styles.chapterHeader}>
            <div className={styles.chapterCode}>
              <span>CAPÍTULO {activeChapter.number}</span>
              <i aria-hidden="true" />
              <small>{activeChapter.eyebrow.toUpperCase()}</small>
            </div>
            <h2 id="chapter-title">{activeChapter.title}</h2>
            <p>{activeChapter.lede}</p>
          </header>

          <div className={styles.chapterGrid}>
            <article className={styles.briefing} aria-labelledby="briefing-title">
              <div className={styles.sectionLabel}>
                <span>01</span>
                <b id="briefing-title">REGRA OPERACIONAL</b>
              </div>
              <ul>
                {activeChapter.principles.map((principle) => (
                  <li key={principle}>{principle}</li>
                ))}
              </ul>
              <DoctrineMetrics chapter={activeChapter} />
            </article>

            <section
              className={styles.demonstration}
              aria-labelledby="demonstration-title"
            >
              <div className={styles.sectionLabel}>
                <span>02</span>
                <b id="demonstration-title">DEMONSTRAÇÃO DA MÁQUINA</b>
              </div>
              <DoctrineChapterDemo
                chapter={activeChapter}
                presentation={presentation}
              />
            </section>
          </div>

          <nav className={styles.prevNext} aria-label="Navegação entre capítulos">
            {previousChapter ? (
              <Link
                href={chapterHref(previousChapter.slug)}
                onClick={(event) => selectChapter(event, previousChapter.slug)}
                prefetch={false}
                scroll={false}
              >
                <span>← ANTERIOR</span>
                <b>{previousChapter.eyebrow}</b>
              </Link>
            ) : (
              <span className={styles.navPlaceholder} aria-hidden="true" />
            )}

            <a className={styles.backToIndex} href="#doctrine-index-title">
              ÍNDICE
            </a>

            {nextChapter ? (
              <Link
                href={chapterHref(nextChapter.slug)}
                onClick={(event) => selectChapter(event, nextChapter.slug)}
                prefetch={false}
                scroll={false}
              >
                <span>PRÓXIMO →</span>
                <b>{nextChapter.eyebrow}</b>
              </Link>
            ) : (
              <Link href="/" className={styles.returnCommand}>
                <span>ENCERRAR</span>
                <b>Voltar ao comando</b>
              </Link>
            )}
          </nav>
        </section>
      </div>
    </main>
  );
}
