import { GuideBoardScene } from "@/src/components/game-guide/guide-board-scene";
import { GuideFlow } from "@/src/components/game-guide/guide-flow";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { GuideStateChange } from "@/src/components/game-guide/guide-state-change";
import { TemporalAnomalyEffectList } from "@/src/components/temporal-anomaly-effect-list";
import type { TemporalAnomalyPresentation } from "@/src/lib/events/event-presentation";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

const anomalyExample: TemporalAnomalyPresentation["effects"] = [
  {
    kind: "troops-removed",
    label: "−2 tropas",
    primary: "São Paulo Oeste",
  },
  {
    kind: "attack-blocked",
    label: "Ataques bloqueados",
    primary: "Goiás",
  },
  {
    kind: "connection-opened",
    label: "Conexão aberta",
    primary: "Bahia Oeste-Sul ↔ Sergipe",
  },
  {
    kind: "barrier-moved",
    label: "Barreira reposicionada",
    primary: "Barreira geográfica",
    secondary: "Uma fronteira deixa de bloquear e outra passa a bloquear",
  },
];

export function GuideAnomalySection({
  guide,
}: {
  guide: GameGuidePresentation;
}) {
  return (
    <article className="wb-guide-chapter wb-guide-section--anomaly">
      <GuideHeading number="14" title="Adapte-se às Anomalias">
        No fim de cada rodada, o tabuleiro pode mudar.
      </GuideHeading>

      <GuideFlow
        compact
        ariaLabel="Mudança de rodada e ativação da Anomalia"
        className="wb-guide-round-flow"
        steps={[
          { key: "turns", label: "Todos jogam" },
          { key: "round-end", label: "Fim da rodada" },
          { key: "anomaly", label: "Nova Anomalia", tone: "accent" },
          { key: "tunnel", label: "Novo Túnel" },
        ]}
      />

      <div className="wb-guide-anomaly-layout">
        <div className="wb-guide-anomaly">
          <div className="wb-guide-anomaly-head">
            <span>◆</span>
            <div>
              <small>Anomalia temporal</small>
              <strong>Tropas, ataques e conexões podem mudar.</strong>
            </div>
          </div>
          <TemporalAnomalyEffectList
            effects={anomalyExample}
            heading="Exemplos de efeitos"
            headingId="guide-anomaly-effects-heading"
            className="temporal-anomaly-effects wb-guide-anomaly-effects"
          />
        </div>

        <div className="wb-guide-anomaly-copy">
          <p>
            Leia a Anomalia como uma mudança no próprio tabuleiro: contadores podem
            cair, uma origem pode perder o ataque e conexões podem abrir ou mudar de
            Barreira.
          </p>

          <GuideStateChange
            ariaLabel="Exemplo no mapa 2D: uma Anomalia reduz tropas e abre uma nova conexão"
            className="wb-guide-anomaly-floor wb-guide-anomaly-board-change"
            before={
              <GuideBoardScene
                compact
                ariaLabel="Tabuleiro antes da Anomalia"
                markers={[
                  { key: "sp-before", label: "São Paulo Oeste", troops: 3, x: 57, y: 73, tone: "ally" },
                  { key: "goias-before", label: "Goiás", troops: 2, x: 43, y: 50, tone: "ally" },
                ]}
              />
            }
            action="Anomalia"
            after={
              <GuideBoardScene
                compact
                ariaLabel="Tabuleiro depois da Anomalia"
                markers={[
                  { key: "sp-after", label: "São Paulo Oeste", troops: guide.anomalies.minimumTroopsAfterRemoval, x: 56, y: 73, tone: "ally", selected: true },
                  { key: "goias-after", label: "Goiás", troops: 2, x: 43, y: 50, tone: "accent" },
                  { key: "bahia-after", label: "Nova conexão", troops: 1, x: 72, y: 41, tone: "neutral" },
                ]}
                arrows={[
                  { key: "opened", from: { x: 50, y: 54 }, to: { x: 63, y: 50 }, kind: "route" },
                ]}
              />
            }
            caption={`Mesmo quando o efeito removeria mais tropas, um território nunca fica abaixo de ${guide.anomalies.minimumTroopsAfterRemoval}.`}
          />
        </div>
      </div>

      <p className="wb-guide-inline-note">
        <strong>Rodada inicial.</strong> A tropa inicial já faz parte da preparação;
        o evento de abertura não adiciona outra.
      </p>
    </article>
  );
}
