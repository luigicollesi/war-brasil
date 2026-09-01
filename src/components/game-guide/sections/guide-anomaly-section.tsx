import { GuideFlow } from "@/src/components/game-guide/guide-flow";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { GuideStateChange } from "@/src/components/game-guide/guide-state-change";
import { GuideTerritoryNode } from "@/src/components/game-guide/guide-territory-node";
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
      <GuideHeading number="14" title="Adapte-se à Anomalia">
        Quando todos os jogadores ativos completam seus turnos, uma nova rodada
        começa. O jogo define a Anomalia da rodada e também muda o destino do Túnel
        Jurássico.
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
              <strong>O estado do tabuleiro pode mudar.</strong>
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
            Uma Anomalia pode adicionar ou remover tropas, impedir territórios de
            iniciar ataques, abrir ou fechar conexões e reposicionar Barreiras
            Geográficas. Mudanças de tropas são aplicadas ao estado do território;
            bloqueios e conexões formam a topologia efetiva da rodada atual.
          </p>

          <GuideStateChange
            ariaLabel="Anomalia não remove a última tropa de um território"
            className="wb-guide-anomaly-floor"
            before={<GuideTerritoryNode name="Território" troops={2} tone="ally" />}
            action="Anomalia −5"
            after={
              <GuideTerritoryNode
                name="Território"
                troops={guide.anomalies.minimumTroopsAfterRemoval}
                tone="ally"
              />
            }
            caption={`Uma remoção nunca deixa o território abaixo de ${guide.anomalies.minimumTroopsAfterRemoval} tropa.`}
          />
        </div>
      </div>

      <p className="wb-guide-inline-note">
        <strong>Rodada inicial.</strong> O evento inicial é narrativo: a tropa com que
        cada território começa já foi aplicada durante a preparação da partida.
      </p>
    </article>
  );
}
