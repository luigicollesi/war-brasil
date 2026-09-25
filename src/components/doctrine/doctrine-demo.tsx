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

function ObjectivesDemo({ presentation }: { presentation: DoctrinePresentation }) {
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
        </aside>
      </div>
    </DemoFrame>
  );
}

function TurnDemo({ chapter }: { chapter: DoctrineChapter }) {
  return (
    <DemoFrame
      label="Fluxo de um turno"
      caption="Trocas antecedem a mobilização quando a fase está disponível; depois vêm reforços, conflito e reposicionamento."
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
      label="Demonstração da fase de Trocas entre jogadores"
      caption={`Negociação não gera tropas. O jogador da vez pode fazer até ${presentation.playerTrade.offerLimitPerTurn} ofertas; os demais humanos ativos podem sinalizar até ${presentation.playerTrade.signalLimitPerTurn} cartas por turno.`}
    >
      <div className={ux.playerTradeStage}>
        <GuideTradeScene
          offerLimit={presentation.playerTrade.offerLimitPerTurn}
          signalLimit={presentation.playerTrade.signalLimitPerTurn}
        />
        <div className={ux.tradeDoctrineNote}>
          <span>NEGOCIAÇÃO ≠ RESGATE</span>
          <strong>Cartas mudam de dono. Tropas só vêm do resgate de uma combinação válida.</strong>
        </div>
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
            caption="A rota precisa existir na topologia vigente da partida."
          />
        </div>

        <aside
          className={`${styles.diceMatrix} ${ux.sceneAside} ${ux.combatAside}`}
          aria-label="Comparação dos dados de ataque e defesa"
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
      label="Demonstração de transferência de tropas após conquista"
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
            caption="A nova fronteira passa a integrar sua linha imediatamente."
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
      label="Demonstração de manobra entre territórios aliados"
      caption={`A seta representa uma rota válida entre territórios próprios. Neste exemplo, ${presentation.maneuver.movableBeforeReceiving} tropas estão móveis antes de receber reforço de manobra; tropas recebidas não podem iniciar outro deslocamento no mesmo turno.`}
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
            caption="A manobra redistribui força: não produz novas tropas."
          />
        </div>
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
            caption="A conexão permanece conhecida; o perfil da travessia é que muda."
          />
        </div>

        <aside
          className={`${ux.sceneAside} ${ux.barrierAside}`}
          aria-label="Custo de dados da travessia"
        >
          <span className={ux.asideLabel}>TRAVESSIA</span>
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
      label="Demonstração de cartas de território e resgate"
      caption={`Resgates seguem progressão pessoal. Com ${presentation.cards.mandatoryTradeHandSize} ou mais cartas, um resgate válido é obrigatório antes de reforçar; isso não é a negociação entre jogadores.`}
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

function EventsDemo({ presentation }: { presentation: DoctrinePresentation }) {
  return (
    <DemoFrame
      label="Demonstração conceitual do sistema de anomalias"
      caption={`O catálogo vigente contém ${presentation.anomalies.eventCount} estados de evento. A interface materializa o efeito resolvido pela engine e preserva ao menos ${presentation.anomalies.minimumTroopsAfterRemoval} tropa em território ocupado quando a anomalia remove forças.`}
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

function DepartureDemo() {
  return (
    <DemoFrame
      label="Demonstração do protocolo de retirada durante uma partida"
      caption="A retirada altera o estado autoritativo da partida em sequência: cartas da mão vão ao descarte, territórios são redistribuídos de forma balanceada e todos os objetivos restantes são reavaliados. Essa redistribuição é a exceção que pode produzir vencedores simultâneos."
    >
      <div className={ux.departureStage}>
        <div className={ux.departureProtocol}>
          <span>PROTOCOLO DE CONTINGÊNCIA</span>
          <strong>RETIRADA EM PARTIDA ATIVA</strong>
          <small>quatro efeitos encadeados · resolução automática</small>
        </div>

        <div className={ux.departureTopFlow}>
          <section className={ux.departureStep}>
            <div className={ux.departureStepCode}>01 // RETIRADA</div>
            <div className={ux.departureCommander} aria-hidden="true">
              <span className={ux.departureCommanderHead} />
              <span className={ux.departureCommanderBody} />
              <b>×</b>
            </div>
            <strong>COMANDANTE FORA DA OPERAÇÃO</strong>
            <small>
              O assento deixa de participar dos turnos e negociações pendentes
              são canceladas.
            </small>
            <div className={ux.departureExitStamp}>RETIRADO</div>
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
            <strong>CARTAS PERDIDAS PELO JOGADOR</strong>
            <small>
              A mão deixa a posse do retirado. Nenhuma carta é herdada
              diretamente por um rival.
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
                ariaLabel="Mapa ilustrando territórios de um jogador retirado sendo redistribuídos entre jogadores com menor controle territorial"
                markers={[
                  {
                    key: "departure-source",
                    label: "Território retirado",
                    troops: 4,
                    x: 50,
                    y: 52,
                    tone: "neutral",
                    selected: true,
                  },
                  {
                    key: "departure-a",
                    label: "Menor controle A",
                    troops: 3,
                    x: 27,
                    y: 32,
                    tone: "ally",
                  },
                  {
                    key: "departure-b",
                    label: "Menor controle B",
                    troops: 2,
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
                caption="Cada território é atribuído a quem possui menos territórios naquele momento; empates são resolvidos aleatoriamente."
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
                MENOR CONTROLE
              </span>
              <i aria-hidden="true">→</i>
              <span>
                <b>3</b>
                DESEMPATE ALEATÓRIO
              </span>
            </div>
            <small className={ux.departureTroopNote}>
              As tropas permanecem no território; somente a propriedade é
              alterada.
            </small>
          </section>

          <section
            className={[ux.departureStep, ux.departureVictoryStep].join(" ")}
          >
            <div className={ux.departureStepCode}>04 // REAVALIAÇÃO</div>
            <div className={ux.departureObjectiveScan}>
              <span>OBJETIVOS RESTANTES</span>
              <div className={ux.departureScanLine} aria-hidden="true" />
              <small>estado territorial alterado</small>
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
              <small>EXCEÇÃO DE ENCERRAMENTO</small>
              <strong>VITÓRIA SIMULTÂNEA</strong>
            </div>
            <p>
              Se a redistribuição completar mais de um objetivo ao mesmo tempo,
              todos esses jogadores vencem. No fluxo atual, essa é a única
              situação que admite múltiplos vencedores simultâneos.
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
      return <DepartureDemo />;
    case "victory":
      return <VictoryDemo />;
  }
}
