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
      <div className={`${styles.phaseRail} ${ux.phaseRail}`}>
        {chapter.metrics.map((phase, index) => (
          <div key={phase.label} className={styles.phaseStep}>
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

function ConquestDemo({ presentation }: { presentation: DoctrinePresentation }) {
  const originTroops = presentation.conquest.minimumTroopsLeftAtOrigin + 2;
  const targetTroops = presentation.conquest.minimumMove;

  return (
    <DemoFrame
      label="Demonstração de transferência de tropas após conquista"
      caption={`A conquista só se completa quando o novo território recebe ao menos ${presentation.conquest.minimumMove} tropa e a origem preserva ${presentation.conquest.minimumTroopsLeftAtOrigin}.`}
    >
      <div className={styles.boardShell}>
        <GuideBoardScene
          compact
          ariaLabel="Tropas se deslocando da origem para um território recém-conquistado"
          markers={[
            { key: "conquest-origin", label: "Origem", troops: originTroops, x: 42, y: 48, tone: "ally" },
            { key: "conquest-target", label: "Conquistado", troops: targetTroops, x: 61, y: 53, tone: "ally", selected: true },
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

function ManeuverDemo({ presentation }: { presentation: DoctrinePresentation }) {
  const originTroops =
    presentation.maneuver.minimumTroopsLeftAtOrigin +
    presentation.maneuver.movableBeforeReceiving;

  return (
    <DemoFrame
      label="Demonstração de manobra entre territórios aliados"
      caption={`A seta representa uma rota válida entre territórios próprios. Neste exemplo, ${presentation.maneuver.movableBeforeReceiving} tropas estão móveis antes de receber reforço de manobra; tropas recebidas não podem iniciar outro deslocamento no mesmo turno.`}
    >
      <div className={styles.boardShell}>
        <GuideBoardScene
          compact
          ariaLabel="Movimentação de tropas entre dois territórios aliados conectados"
          markers={[
            { key: "move-origin", label: "Reserva", troops: originTroops, x: 43, y: 56, tone: "ally", selected: true },
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
    case "victory":
      return <VictoryDemo />;
  }
}
