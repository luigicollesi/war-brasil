import type { ReactNode } from "react";
import { GameDie } from "@/src/components/game-die";
import { GuideBoardScene } from "@/src/components/game-guide/guide-board-scene";
import { GuideTradeScene } from "@/src/components/game-guide/guide-trade-scene";
import { TerritoryCardArtwork } from "@/src/components/territory-card-artwork";
import type {
  DoctrineChapter,
  DoctrinePresentation,
} from "@/src/lib/doctrine-presentation";
import styles from "./doctrine-experience.module.css";
import ux from "./doctrine-ux-enhancements.module.css";

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
      label="Exemplo de como a partida começa no mapa do Brasil"
      caption="No começo, o mapa é dividido entre os jogadores. Cada território já começa ocupado e com tropas."
    >
      <div className={styles.boardShell}>
        <GuideBoardScene
          compact
          ariaLabel="Mapa de preparação com territórios pertencendo a jogadores diferentes"
          markers={[
            { key: "setup-a", label: "Setor Norte", troops: 1, x: 34, y: 31, tone: "ally" },
            { key: "setup-b", label: "Setor Leste", troops: 1, x: 65, y: 43, tone: "enemy" },
            { key: "setup-c", label: "Setor Centro", troops: 1, x: 49, y: 56, tone: "accent" },
            { key: "setup-d", label: "Setor Sul", troops: 1, x: 48, y: 77, tone: "neutral" },
          ]}
          caption="Exemplo de distribuição inicial dos territórios."
        />
      </div>
      <div className={styles.statusRail} aria-hidden="true">
        <span data-tone="ally">JOGADOR A</span>
        <span data-tone="enemy">JOGADOR B</span>
        <span data-tone="accent">JOGADOR C</span>
      </div>
    </DemoFrame>
  );
}

function ObjectivesDemo({ presentation }: { presentation: DoctrinePresentation }) {
  return (
    <DemoFrame
      label="Exemplo dos tipos de objetivo"
      caption="Estes são os tipos de objetivo que podem aparecer. O objetivo de cada jogador continua secreto."
    >
      <div className={styles.objectiveCore}>
        <div className={styles.classifiedStamp}>OBJETIVO SECRETO</div>
        <div className={styles.objectiveGlyph} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className={styles.objectiveList}>
          {presentation.objectiveFormats.map((format, index) => (
            <div key={format.title}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <span>
                <strong>{format.title}</strong>
                <small>{format.description}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </DemoFrame>
  );
}

function TurnDemo({ chapter }: { chapter: DoctrineChapter }) {
  return (
    <DemoFrame
      label="Ordem das fases do turno"
      caption="Quando houver Trocas, elas vêm primeiro. Depois o turno segue com Reforços, Ataque e Manobra."
    >
      <div className={`${styles.phaseRail} ${ux.phaseRail} ${ux.machineSceneRail}`}>
        {chapter.metrics.map((phase, index) => (
          <div
            key={phase.label}
            className={`${styles.phaseStep} ${ux.phaseCard}`}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{phase.value.toUpperCase()}</strong>
            <small>{phase.detail}</small>
            {index < chapter.metrics.length - 1 ? <i aria-hidden="true">→</i> : null}
          </div>
        ))}
      </div>
    </DemoFrame>
  );
}

function TradeDemo({ presentation }: { presentation: DoctrinePresentation }) {
  return (
    <DemoFrame
      label="Exemplo de Trocas entre jogadores"
      caption={`Trocar cartas não dá tropas. No seu turno, você pode fazer até ${presentation.playerTrade.offerLimitPerTurn} ofertas. Os outros jogadores humanos podem marcar até ${presentation.playerTrade.signalLimitPerTurn} cartas por turno para mostrar o que aceitam trocar.`}
    >
      <div className={ux.playerTradeStage}>
        <GuideTradeScene
          offerLimit={presentation.playerTrade.offerLimitPerTurn}
          signalLimit={presentation.playerTrade.signalLimitPerTurn}
        />
        <div className={ux.tradeDoctrineNote}>
          <span>TROCA NÃO É RESGATE</span>
          <strong>Na Troca, cartas mudam de dono. No Resgate, uma combinação válida de cartas dá tropas.</strong>
        </div>
      </div>
    </DemoFrame>
  );
}

function ReinforcementDemo({ presentation }: { presentation: DoctrinePresentation }) {
  return (
    <DemoFrame
      label="Exemplo de distribuição de Reforços"
      caption={`Com ${presentation.reinforcement.territoryExample} territórios, você recebe ${presentation.reinforcement.baseExample} tropas de Reforço antes dos bônus de região e de cartas.`}
    >
      <div className={styles.reinforcementStage}>
        <GuideBoardScene
          compact
          ariaLabel="Dois territórios aliados recebendo reforços"
          markers={[
            { key: "reinforce-a", label: "Goiás", troops: 4, x: 47, y: 55, tone: "ally", selected: true },
            { key: "reinforce-b", label: "Bahia", troops: 5, x: 62, y: 49, tone: "ally", selected: true },
          ]}
          caption="Coloque todas as tropas de Reforço nos seus territórios antes de seguir para o Ataque."
        />
        <div className={styles.reinforcementReadout}>
          <span>REFORÇOS</span>
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
      label="Exemplo de Ataque e comparação dos dados"
      caption="Compare os dados do maior para o menor. Em cada par, o maior vence; se empatar, a Defesa vence."
    >
      <div className={`${styles.attackStage} ${ux.machineSceneSplit} ${ux.attackScene}`}>
        <div className={ux.sceneBoard}>
          <GuideBoardScene
            compact
            ariaLabel="Território aliado com quatro tropas atacando território inimigo conectado"
            markers={[
              { key: "attack-origin", label: "Origem", troops: 4, x: 35, y: 49, tone: "ally", selected: true },
              { key: "attack-target", label: "Alvo inimigo", troops: 2, x: 66, y: 53, tone: "enemy" },
            ]}
            arrows={[
              {
                key: "attack-route",
                from: { x: 40, y: 49 },
                to: { x: 61, y: 52 },
                kind: "attack",
                label: "ATAQUE",
              },
            ]}
            caption="Os dois territórios precisam ter uma ligação válida no mapa."
          />
        </div>

        <aside
          className={`${styles.diceMatrix} ${ux.sceneAside} ${ux.combatAside}`}
          aria-label="Dados do Ataque e da Defesa"
        >
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
        </aside>
      </div>
    </DemoFrame>
  );
}

function ConquestDemo({ presentation }: { presentation: DoctrinePresentation }) {
  const originTroops = presentation.conquest.minimumTroopsLeftAtOrigin + 2;
  const targetTroops = presentation.conquest.minimumMove;

  return (
    <DemoFrame
      label="Exemplo de ocupação depois de uma conquista"
      caption={`A conquista só se completa quando o novo território recebe ao menos ${presentation.conquest.minimumMove} tropa e a origem preserva ${presentation.conquest.minimumTroopsLeftAtOrigin}.`}
    >
      <div className={`${styles.boardShell} ${ux.machineSceneCentered} ${ux.conquestScene}`}>
        <div className={ux.sceneBoard}>
          <GuideBoardScene
            compact
            ariaLabel="Tropas se deslocando da origem para um território recém-conquistado"
            markers={[
              { key: "conquest-origin", label: "Origem", troops: originTroops, x: 34, y: 50, tone: "ally" },
              { key: "conquest-target", label: "Conquistado", troops: targetTroops, x: 67, y: 52, tone: "ally", selected: true },
            ]}
            arrows={[
              {
                key: "occupation",
                from: { x: 40, y: 50 },
                to: { x: 61, y: 52 },
                kind: "move",
                label: "OCUPAR",
              },
            ]}
            caption="Depois de ocupar o território, ele já passa a ser seu."
          />
        </div>
      </div>
    </DemoFrame>
  );
}

function ManeuverDemo({ presentation }: { presentation: DoctrinePresentation }) {
  const originTroops =
    presentation.maneuver.minimumTroopsLeftAtOrigin +
    presentation.maneuver.movableBeforeReceiving;

  return (
    <DemoFrame
      label="Exemplo de Manobra entre seus territórios"
      caption={`A seta mostra por onde as tropas podem passar entre seus territórios. Neste exemplo, ${presentation.maneuver.movableBeforeReceiving} tropas estão móveis antes de receber reforço de manobra; tropas recebidas não podem iniciar outro deslocamento no mesmo turno.`}
    >
      <div className={`${styles.boardShell} ${ux.machineSceneOverlay} ${ux.maneuverScene}`}>
        <div className={ux.sceneBoard}>
          <GuideBoardScene
            compact
            ariaLabel="Movimentação de tropas entre dois territórios aliados conectados"
            markers={[
              { key: "move-origin", label: "Reserva", troops: originTroops, x: 33, y: 59, tone: "ally", selected: true },
              { key: "move-target", label: "Fronteira", troops: 3, x: 68, y: 43, tone: "ally", moved: true },
            ]}
            arrows={[
              {
                key: "maneuver",
                from: { x: 40, y: 56 },
                to: { x: 62, y: 46 },
                kind: "move",
                label: "MANOBRA",
              },
            ]}
            caption="A Manobra apenas move tropas que você já tem."
          />
        </div>
      </div>
    </DemoFrame>
  );
}

function BarrierDemo({ presentation }: { presentation: DoctrinePresentation }) {
  return (
    <DemoFrame
      label="Exemplo de uma barreira entre dois territórios"
      caption={`Uma barreira torna o ataque mais caro e a manobra perde ${presentation.barrier.maneuverLoss} tropa na travessia; ${presentation.barrier.blockedBarrierCount} ou mais barreiras bloqueiam a rota de manobra.`}
    >
      <div className={`${styles.barrierStage} ${ux.machineSceneSplit} ${ux.barrierScene}`}>
        <div className={ux.sceneBoard}>
          <GuideBoardScene
            compact
            ariaLabel="Dois territórios separados por uma conexão com barreira"
            markers={[
              { key: "barrier-origin", label: "Origem", troops: 7, x: 34, y: 51, tone: "ally", selected: true },
              { key: "barrier-target", label: "Além da barreira", troops: 2, x: 68, y: 50, tone: "enemy" },
            ]}
            arrows={[
              {
                key: "barrier-route",
                from: { x: 40, y: 51 },
                to: { x: 62, y: 50 },
                kind: "route",
                label: "BARREIRA",
              },
            ]}
            caption="A ligação continua existindo, mas atravessá-la fica mais difícil."
          />
        </div>

        <aside
          className={`${ux.sceneAside} ${ux.barrierAside}`}
          aria-label="Dados permitidos ao atravessar a barreira"
        >
          <span className={ux.asideLabel}>ATAQUE PELA BARREIRA</span>
          <div className={`${styles.barrierBands} ${ux.barrierBandsRefined}`}>
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
        </aside>
      </div>
    </DemoFrame>
  );
}

function CardsDemo({ presentation }: { presentation: DoctrinePresentation }) {
  return (
    <DemoFrame
      label="Exemplo de cartas e Resgate"
      caption={`Cada jogador tem sua própria sequência de valores de Resgate. Com ${presentation.cards.mandatoryTradeHandSize} ou mais cartas, você precisa fazer um Resgate válido antes de distribuir os Reforços.`}
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
          <span>VALOR DO RESGATE</span>
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

function EventsDemo({ presentation }: { presentation: DoctrinePresentation }) {
  return (
    <DemoFrame
      label="Exemplo de uma Anomalia"
      caption={`Existem ${presentation.anomalies.eventCount} Anomalias possíveis. Cada uma mostra o que muda. Se uma Anomalia remover tropas de um território ocupado, pelo menos ${presentation.anomalies.minimumTroopsAfterRemoval} tropa continua nele.`}
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
          <span>ANOMALIA</span>
          <strong>MAPA ALTERADO</strong>
          <small>efeito temporário</small>
        </div>
      </div>
    </DemoFrame>
  );
}

function DepartureDemo({ presentation }: { presentation: DoctrinePresentation }) {
  return (
    <DemoFrame
      label="O que acontece quando um jogador sai da partida"
      caption={`Quando um jogador sai, suas cartas vão para o descarte. Os territórios são embaralhados e distribuídos tentando equilibrar a quantidade de territórios entre quem continua; cada território recebido fica com ${presentation.departure.redistributedTroops} tropa. Depois, os objetivos são verificados outra vez.`}
    >
      <div className={ux.departureStage}>
        <div className={ux.departureProtocol}>
          <span>SAÍDA DURANTE A PARTIDA</span>
          <strong>JOGADOR SAI DA PARTIDA</strong>
          <small>quatro passos acontecem em seguida</small>
        </div>

        <div className={ux.departureTopFlow}>
          <section className={ux.departureStep}>
            <div className={ux.departureStepCode}>01 // RETIRADA</div>
            <div className={ux.departureCommander} aria-hidden="true">
              <span className={ux.departureCommanderHead} />
              <span className={ux.departureCommanderBody} />
              <b>×</b>
            </div>
            <strong>JOGADOR FORA DA PARTIDA</strong>
            <small>
              O jogador não participa mais dos turnos e as Trocas pendentes
              são canceladas.
            </small>
            <div className={ux.departureExitStamp}>SAIU</div>
          </section>

          <div className={ux.departureConnector} aria-hidden="true">
            <span />
            <b>→</b>
          </div>

          <section className={ux.departureStep}>
            <div className={ux.departureStepCode}>02 // CARTAS</div>
            <div className={ux.departureCardTransfer} aria-hidden="true">
              <div className={ux.departureCards}>
                <TerritoryCardArtwork
                  territoryId={18}
                  symbol="gold"
                  sizes="78px"
                  className={ux.departureCard}
                />
                <TerritoryCardArtwork
                  territoryId={23}
                  symbol="water"
                  sizes="78px"
                  className={ux.departureCard}
                />
              </div>
              <span className={ux.departureCardArrow}>→</span>
              <div className={ux.departureDiscard}>
                <small>ZONA</small>
                <strong>DESCARTE</strong>
                <b>02</b>
              </div>
            </div>
            <strong>CARTAS VÃO PARA O DESCARTE</strong>
            <small>
              As cartas deixam a mão de quem saiu e não vão diretamente
              para nenhum outro jogador.
            </small>
          </section>
        </div>

        <div className={ux.departureLowerFlow}>
          <section
            className={[ux.departureStep, ux.departureMapStep].join(" ")}
          >
            <div className={ux.departureStepCode}>03 // TERRITÓRIOS</div>
            <div className={ux.departureMap}>
              <GuideBoardScene
                compact
                ariaLabel="Mapa mostrando os territórios de quem saiu sendo entregues aos jogadores com menos territórios"
                markers={[
                  {
                    key: "departure-source",
                    label: "Território de quem saiu",
                    troops: 4,
                    x: 50,
                    y: 52,
                    tone: "neutral",
                    selected: true,
                  },
                  {
                    key: "departure-a",
                    label: "Jogador A",
                    troops: presentation.departure.redistributedTroops,
                    x: 27,
                    y: 32,
                    tone: "ally",
                  },
                  {
                    key: "departure-b",
                    label: "Jogador B",
                    troops: presentation.departure.redistributedTroops,
                    x: 73,
                    y: 67,
                    tone: "enemy",
                  },
                ]}
                arrows={[
                  {
                    key: "departure-route-a",
                    from: { x: 47, y: 49 },
                    to: { x: 32, y: 35 },
                    kind: "move",
                    label: "ATRIBUIR",
                  },
                  {
                    key: "departure-route-b",
                    from: { x: 53, y: 55 },
                    to: { x: 68, y: 64 },
                    kind: "move",
                  },
                ]}
                caption="Os territórios são embaralhados e entregues um por um. A cada entrega, o jogo prioriza quem tem menos territórios; em caso de empate, a escolha é aleatória."
              />
            </div>
            <div className={ux.departureBalanceRail}>
              <span>
                <b>1</b>
                EMBARALHAR
              </span>
              <i aria-hidden="true">→</i>
              <span>
                <b>2</b>
                MENOS TERRITÓRIOS
              </span>
              <i aria-hidden="true">→</i>
              <span>
                <b>3</b>
                DESEMPATE ALEATÓRIO
              </span>
              <i aria-hidden="true">→</i>
              <span>
                <b>4</b>
                {presentation.departure.redistributedTroops} TROPA
              </span>
            </div>
            <small className={ux.departureTroopNote}>
              Não importa quantas tropas havia antes: cada território
              redistribuído fica com {presentation.departure.redistributedTroops}.
            </small>
          </section>

          <section
            className={[ux.departureStep, ux.departureVictoryStep].join(" ")}
          >
            <div className={ux.departureStepCode}>04 // OBJETIVOS</div>
            <div className={ux.departureObjectiveScan}>
              <span>OBJETIVOS RESTANTES</span>
              <div className={ux.departureScanLine} aria-hidden="true" />
              <small>depois da redistribuição</small>
            </div>
            <div className={ux.departureWinnerPair}>
              <div className={ux.departureWinner}>
                <span>A</span>
                <small>MISSÃO</small>
                <strong>CONCLUÍDA</strong>
              </div>
              <b aria-hidden="true">+</b>
              <div className={ux.departureWinner}>
                <span>B</span>
                <small>MISSÃO</small>
                <strong>CONCLUÍDA</strong>
              </div>
            </div>
            <div className={ux.departureVictoryBanner}>
              <small>CASO ESPECIAL</small>
              <strong>VITÓRIA SIMULTÂNEA</strong>
            </div>
            <p>
              Se a redistribuição completar mais de um objetivo ao mesmo tempo,
              todos esses jogadores vencem. Essa é a única situação em que
              mais de um jogador pode vencer ao mesmo tempo.
            </p>
          </section>
        </div>
      </div>
    </DemoFrame>
  );
}

function VictoryDemo() {
  return (
    <DemoFrame
      label="Exemplo de como a Vitória acontece"
      caption="Você vence quando cumpre o seu objetivo. Ter mais territórios, tropas ou cartas só vence a partida se isso fizer parte do seu objetivo."
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
          <span>CUMPRIU</span>
          <i aria-hidden="true" />
          <b>VITÓRIA</b>
        </div>
      </div>
    </DemoFrame>
  );
}

export function DoctrineChapterDemo({
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
      return <ObjectivesDemo presentation={presentation} />;
    case "turn":
      return <TurnDemo chapter={chapter} />;
    case "trade":
      return <TradeDemo presentation={presentation} />;
    case "reinforcement":
      return <ReinforcementDemo presentation={presentation} />;
    case "attack":
      return <AttackDemo presentation={presentation} />;
    case "conquest":
      return <ConquestDemo presentation={presentation} />;
    case "maneuver":
      return <ManeuverDemo presentation={presentation} />;
    case "barriers":
      return <BarrierDemo presentation={presentation} />;
    case "cards":
      return <CardsDemo presentation={presentation} />;
    case "events":
      return <EventsDemo presentation={presentation} />;
    case "departure":
      return <DepartureDemo presentation={presentation} />;
    case "victory":
      return <VictoryDemo />;
  }
}
