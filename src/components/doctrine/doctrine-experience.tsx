"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { GameDie } from "@/src/components/game-die";
import { GuideBoardScene } from "@/src/components/game-guide/guide-board-scene";
import { TerritoryCardArtwork } from "@/src/components/territory-card-artwork";
import {
  isDoctrineChapterSlug,
  type DoctrineChapter,
  type DoctrineChapterSlug,
  type DoctrinePresentation,
} from "@/src/lib/doctrine-presentation";
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

function DoctrineMark() {
  return (
    <div className={styles.mark} aria-hidden="true">
      <span />
      <b>WB</b>
      <span />
    </div>
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

function DemoFrame({
  label,
  children,
  caption,
}: {
  label: string;
  children: ReactNode;
  caption: ReactNode;
}) {
  return (
    <figure className={styles.demoFrame} aria-label={label}>
      <div className={styles.demoViewport}>{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function SetupDemo() {
  return (
    <DemoFrame
      label="Demonstração de preparação da partida no mapa do Brasil"
      caption="O mapa começa repartido entre facções. Cada placa já nasce ocupada e a topologia inicial passa a orientar risco, expansão e defesa."
    >
      <div className={styles.boardShell}>
        <GuideBoardScene
          compact
          ariaLabel="Mapa de preparação com quatro territórios ilustrativos pertencendo a facções diferentes"
          markers={[
            { key: "setup-a", label: "Setor Norte", troops: 1, x: 34, y: 31, tone: "ally" },
            { key: "setup-b", label: "Setor Leste", troops: 1, x: 65, y: 43, tone: "enemy" },
            { key: "setup-c", label: "Setor Centro", troops: 1, x: 49, y: 56, tone: "accent" },
            { key: "setup-d", label: "Setor Sul", troops: 1, x: 48, y: 77, tone: "neutral" },
          ]}
          caption="Distribuição ilustrativa — a regra é determinada pelo estado inicial da partida."
        />
      </div>
      <div className={styles.statusRail} aria-hidden="true">
        <span data-tone="ally">FACÇÃO A</span>
        <span data-tone="enemy">FACÇÃO B</span>
        <span data-tone="accent">FACÇÃO C</span>
      </div>
    </DemoFrame>
  );
}

function ObjectivesDemo() {
  const types = [
    ["DOMÍNIO", "Controlar territórios ou regiões."],
    ["FORTIFICAÇÃO", "Sustentar forças mínimas em posições-chave."],
    ["ELIMINAÇÃO", "Neutralizar um alvo quando o objetivo exigir."],
  ] as const;

  return (
    <DemoFrame
      label="Demonstração dos formatos de objetivo"
      caption="A interface ensina categorias e condições sem ler o objetivo privado de nenhum jogador conectado."
    >
      <div className={styles.objectiveCore}>
        <div className={styles.classifiedStamp}>ACESSO RESTRITO</div>
        <div className={styles.objectiveGlyph} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className={styles.objectiveList}>
          {types.map(([title, text], index) => (
            <div key={title}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </DemoFrame>
  );
}

function TurnDemo() {
  const phases = [
    ["01", "REFORÇAR", "Converter controle em capacidade."],
    ["02", "ATACAR", "Projetar força através das conexões."],
    ["03", "MANOBRAR", "Recompor a linha para o próximo ciclo."],
  ] as const;

  return (
    <DemoFrame
      label="Fluxo de um turno"
      caption="As fases separam logística, conflito e reposicionamento para que cada decisão tenha uma responsabilidade clara."
    >
      <div className={styles.phaseRail}>
        {phases.map(([number, title, text], index) => (
          <div key={title} className={styles.phaseStep}>
            <span>{number}</span>
            <strong>{title}</strong>
            <small>{text}</small>
            {index < phases.length - 1 ? <i aria-hidden="true">→</i> : null}
          </div>
        ))}
      </div>
    </DemoFrame>
  );
}

function ReinforcementDemo({ presentation }: { presentation: DoctrinePresentation }) {
  return (
    <DemoFrame
      label="Demonstração de alocação de reforços"
      caption={`No exemplo derivado da regra, ${presentation.reinforcement.territoryExample} territórios produzem ${presentation.reinforcement.baseExample} tropas de reforço base antes de bônus adicionais.`}
    >
      <div className={styles.reinforcementStage}>
        <GuideBoardScene
          compact
          ariaLabel="Dois territórios aliados recebendo reforços"
          markers={[
            { key: "reinforce-a", label: "Goiás", troops: 4, x: 47, y: 55, tone: "ally", selected: true },
            { key: "reinforce-b", label: "Bahia", troops: 5, x: 62, y: 49, tone: "ally", selected: true },
          ]}
          caption="Distribua o saldo entre territórios próprios antes de avançar para o conflito."
        />
        <div className={styles.reinforcementReadout}>
          <span>SALDO</span>
          <b>+{presentation.reinforcement.baseExample}</b>
          <small>TROPAS BASE</small>
        </div>
      </div>
    </DemoFrame>
  );
}

function AttackDemo({ presentation }: { presentation: DoctrinePresentation }) {
  return (
    <DemoFrame
      label="Demonstração de ataque e comparação de dados"
      caption="Os dados são ordenados do maior para o menor. Cada par resolve uma comparação; empate favorece a defesa."
    >
      <div className={styles.attackStage}>
        <GuideBoardScene
          compact
          ariaLabel="Território aliado com quatro tropas atacando território inimigo conectado"
          markers={[
            { key: "attack-origin", label: "Origem", troops: 4, x: 42, y: 48, tone: "ally", selected: true },
            { key: "attack-target", label: "Alvo inimigo", troops: 2, x: 61, y: 53, tone: "enemy" },
          ]}
          arrows={[
            {
              key: "attack-route",
              from: { x: 44, y: 48 },
              to: { x: 59, y: 52 },
              kind: "attack",
              label: "ATAQUE",
            },
          ]}
          caption="A rota precisa existir na topologia vigente da partida."
        />
        <div className={styles.diceMatrix}>
          <div>
            <span>ATAQUE</span>
            <div>
              {presentation.combatExample.comparisons.map((comparison) => (
                <GameDie
                  key={`attack-${comparison.key}`}
                  value={comparison.attack}
                  color="ruby"
                  size="sm"
                />
              ))}
              {presentation.combatExample.unpairedAttack.map((value, index) => (
                <GameDie key={`attack-extra-${index}`} value={value} color="ruby" size="sm" />
              ))}
            </div>
          </div>
          <strong className={styles.versus}>×</strong>
          <div>
            <span>DEFESA</span>
            <div>
              {presentation.combatExample.comparisons.map((comparison) => (
                <GameDie
                  key={`defense-${comparison.key}`}
                  value={comparison.defense}
                  color="ocean"
                  size="sm"
                />
              ))}
              {presentation.combatExample.unpairedDefense.map((value, index) => (
                <GameDie key={`defense-extra-${index}`} value={value} color="ocean" size="sm" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}

function ConquestDemo() {
  return (
    <DemoFrame
      label="Demonstração de transferência de tropas após conquista"
      caption="A conquista só se completa quando o novo território recebe tropas e a origem permanece ocupada."
    >
      <div className={styles.boardShell}>
        <GuideBoardScene
          compact
          ariaLabel="Tropas se deslocando da origem para um território recém-conquistado"
          markers={[
            { key: "conquest-origin", label: "Origem", troops: 3, x: 42, y: 48, tone: "ally" },
            { key: "conquest-target", label: "Conquistado", troops: 2, x: 61, y: 53, tone: "ally", selected: true },
          ]}
          arrows={[
            {
              key: "occupation",
              from: { x: 44, y: 48 },
              to: { x: 59, y: 52 },
              kind: "move",
              label: "OCUPAR",
            },
          ]}
          caption="A nova fronteira passa a integrar sua linha imediatamente."
        />
      </div>
    </DemoFrame>
  );
}

function ManeuverDemo() {
  return (
    <DemoFrame
      label="Demonstração de manobra entre territórios aliados"
      caption="A seta representa uma rota válida entre territórios próprios. Tropas recebidas nessa fase não podem iniciar outro deslocamento no mesmo turno."
    >
      <div className={styles.boardShell}>
        <GuideBoardScene
          compact
          ariaLabel="Movimentação de tropas entre dois territórios aliados conectados"
          markers={[
            { key: "move-origin", label: "Reserva", troops: 5, x: 43, y: 56, tone: "ally", selected: true },
            { key: "move-target", label: "Fronteira", troops: 3, x: 62, y: 48, tone: "ally", moved: true },
          ]}
          arrows={[
            {
              key: "maneuver",
              from: { x: 45, y: 55 },
              to: { x: 60, y: 49 },
              kind: "move",
              label: "MANOBRA",
            },
          ]}
          caption="A manobra redistribui força: não produz novas tropas."
        />
      </div>
    </DemoFrame>
  );
}

function BarrierDemo({ presentation }: { presentation: DoctrinePresentation }) {
  return (
    <DemoFrame
      label="Demonstração do efeito de uma barreira em uma conexão"
      caption={`Uma barreira torna o ataque mais caro e a manobra perde ${presentation.barrier.maneuverLoss} tropa na travessia; ${presentation.barrier.blockedBarrierCount} ou mais barreiras bloqueiam a rota de manobra.`}
    >
      <div className={styles.barrierStage}>
        <GuideBoardScene
          compact
          ariaLabel="Dois territórios separados por uma conexão com barreira"
          markers={[
            { key: "barrier-origin", label: "Origem", troops: 7, x: 41, y: 50, tone: "ally", selected: true },
            { key: "barrier-target", label: "Além da barreira", troops: 2, x: 63, y: 51, tone: "enemy" },
          ]}
          arrows={[
            {
              key: "barrier-route",
              from: { x: 44, y: 50 },
              to: { x: 60, y: 51 },
              kind: "route",
              label: "BARREIRA",
            },
          ]}
          caption="A conexão permanece conhecida; o perfil da travessia é que muda."
        />
        <div className={styles.barrierBands}>
          {presentation.barrier.attackDiceBands.map((band) => (
            <div key={`${band.minimumTroops}-${band.maximumTroops ?? "max"}`}>
              <span>
                {band.maximumTroops === null
                  ? `${band.minimumTroops}+ tropas`
                  : `${band.minimumTroops}–${band.maximumTroops} tropas`}
              </span>
              <strong>{band.diceCount}D</strong>
            </div>
          ))}
        </div>
      </div>
    </DemoFrame>
  );
}

function CardsDemo({ presentation }: { presentation: DoctrinePresentation }) {
  return (
    <DemoFrame
      label="Demonstração de cartas de território e resgate"
      caption={`Os resgates seguem progressão pessoal. Com ${presentation.cards.mandatoryTradeHandSize} ou mais cartas, uma troca válida é obrigatória antes de reforçar.`}
    >
      <div className={styles.cardsStage}>
        <div className={styles.cardFan} aria-hidden="true">
          <TerritoryCardArtwork
            territoryId={18}
            symbol="gold"
            sizes="132px"
            className={styles.doctrineCard}
          />
          <TerritoryCardArtwork
            territoryId={23}
            symbol="water"
            sizes="132px"
            className={styles.doctrineCard}
          />
          <TerritoryCardArtwork
            territoryId={14}
            symbol="leaf"
            sizes="132px"
            className={styles.doctrineCard}
          />
        </div>
        <div className={styles.tradeProgression}>
          <span>RESGATE PESSOAL</span>
          {presentation.cards.tradeValues.slice(0, 4).map((value, index) => (
            <div key={`trade-${index}`}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <i aria-hidden="true" />
              <strong>+{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </DemoFrame>
  );
}

function EventsDemo() {
  return (
    <DemoFrame
      label="Demonstração conceitual do sistema de anomalias"
      caption="O evento selecionado altera a partida por regras já resolvidas pela engine. A interface apenas materializa o efeito e seu alcance."
    >
      <div className={styles.eventStage}>
        <div className={styles.eventGraph} aria-hidden="true">
          <span className={styles.eventNodePrimary}>A</span>
          <span>B</span>
          <span>C</span>
          <span>D</span>
          <i />
          <i />
          <i />
        </div>
        <div className={styles.eventReadout}>
          <span>ANOMALIA ATIVA</span>
          <strong>TOPOLOGIA ALTERADA</strong>
          <small>efeito temporário · origem autoritativa</small>
        </div>
      </div>
    </DemoFrame>
  );
}

function VictoryDemo() {
  return (
    <DemoFrame
      label="Demonstração da validação de vitória"
      caption="O estado autoritativo confirma a missão. Aparência de domínio não substitui a condição programada do objetivo."
    >
      <div className={styles.victoryStage}>
        <div className={styles.victorySeal} aria-hidden="true">
          <span />
          <b>MISSÃO</b>
          <strong>CONCLUÍDA</strong>
          <span />
        </div>
        <div className={styles.victoryTrace}>
          <span>OBJETIVO</span>
          <i aria-hidden="true" />
          <span>ESTADO</span>
          <i aria-hidden="true" />
          <b>VITÓRIA</b>
        </div>
      </div>
    </DemoFrame>
  );
}

function ChapterDemo({
  chapter,
  presentation,
}: {
  chapter: DoctrineChapter;
  presentation: DoctrinePresentation;
}) {
  switch (chapter.visual) {
    case "setup":
      return <SetupDemo />;
    case "objectives":
      return <ObjectivesDemo />;
    case "turn":
      return <TurnDemo />;
    case "reinforcement":
      return <ReinforcementDemo presentation={presentation} />;
    case "attack":
      return <AttackDemo presentation={presentation} />;
    case "conquest":
      return <ConquestDemo />;
    case "maneuver":
      return <ManeuverDemo />;
    case "barriers":
      return <BarrierDemo presentation={presentation} />;
    case "cards":
      return <CardsDemo presentation={presentation} />;
    case "events":
      return <EventsDemo />;
    case "victory":
      return <VictoryDemo />;
  }
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
    <main className={styles.page} data-doctrine-chapter={activeChapter.slug}>
      <div className={styles.ambientGrid} aria-hidden="true" />
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Voltar para WAR Brasil">
          <DoctrineMark />
          <span>
            <b>WAR BRASIL</b>
            <small>ARQUIVO DE COMANDO</small>
          </span>
        </Link>
        <div className={styles.status} aria-label="Status da Doutrina">
          <span>PROTOCOLO</span>
          <b>DOUTRINA</b>
          <i aria-hidden="true" />
          <small>ONLINE</small>
        </div>
      </header>

      <div className={styles.shell}>
        <aside className={styles.indexPanel} aria-labelledby="doctrine-index-title">
          <div className={styles.indexHeader}>
            <span>WB / DTR</span>
            <small>{String(presentation.chapters.length).padStart(2, "0")} REGISTROS</small>
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

            <section className={styles.demonstration} aria-labelledby="demonstration-title">
              <div className={styles.sectionLabel}>
                <span>02</span>
                <b id="demonstration-title">DEMONSTRAÇÃO DA MÁQUINA</b>
              </div>
              <ChapterDemo chapter={activeChapter} presentation={presentation} />
            </section>
          </div>

          <nav className={styles.prevNext} aria-label="Navegação entre capítulos">
            {previousChapter ? (
              <Link
                href={chapterHref(previousChapter.slug)}
                onClick={(event) => selectChapter(event, previousChapter.slug)}
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
