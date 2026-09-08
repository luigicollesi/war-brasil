import { GuideBoardScene } from "@/src/components/game-guide/guide-board-scene";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { GuideRuleScale } from "@/src/components/game-guide/guide-rule-scale";
import { GuideStateChange } from "@/src/components/game-guide/guide-state-change";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

function territoryLabel(minimum: number, maximum: number | null) {
  return maximum === null
    ? `${minimum}+ territórios`
    : minimum === maximum
      ? `${minimum} territórios`
      : `${minimum}–${maximum} territórios`;
}

export function GuideReinforcementSection({
  guide,
}: {
  guide: GameGuidePresentation;
}) {
  return (
    <article className="wb-guide-chapter wb-guide-section--reinforcement">
      <div className="wb-guide-core-split">
        <div className="wb-guide-copy">
          <GuideHeading number="05" title="Reforce seus territórios">
            Receba metade dos territórios que controla, arredondada para baixo, com
            mínimo de {guide.reinforcement.minimum} tropas. Regiões completas e cartas
            aumentam esse reforço.
          </GuideHeading>

          <p className="wb-guide-inline-note">
            <strong>Antes de reforçar.</strong> Se houver uma troca obrigatória, troque
            as cartas primeiro.
          </p>
        </div>

        <div className="wb-guide-visual wb-guide-reinforcement-rules">
          <GuideRuleScale
            ariaLabel="Como calcular o reforço base"
            items={[
              {
                key: "base",
                label: `${guide.reinforcement.territoryExample} territórios`,
                value: `+${guide.reinforcement.baseExample} tropas`,
                detail: "Metade dos territórios, arredondada para baixo.",
                tone: "accent",
              },
              {
                key: "minimum",
                label: `${guide.reinforcement.minimumExample.territoryCount} territórios`,
                value: `+${guide.reinforcement.minimumExample.final} tropas`,
                detail: `${guide.reinforcement.minimumExample.rawHalf} pela metade; aplica-se o mínimo de ${guide.reinforcement.minimum}.`,
              },
            ]}
          />
        </div>
      </div>

      <GuideStateChange
        ariaLabel="Exemplo no mapa 2D: seis reforços são distribuídos entre dois territórios próprios"
        className="wb-guide-reinforcement-example wb-guide-reinforcement-board-change"
        before={
          <GuideBoardScene
            compact
            ariaLabel="Antes dos reforços"
            markers={[
              { key: "goias-before", label: "Goiás", troops: 2, x: 48, y: 54, tone: "ally" },
              { key: "bahia-before", label: "Bahia", troops: 1, x: 62, y: 49, tone: "ally" },
            ]}
          />
        }
        action="+6 reforços"
        after={
          <GuideBoardScene
            compact
            ariaLabel="Depois dos reforços"
            markers={[
              { key: "goias-after", label: "Goiás", troops: 4, x: 48, y: 54, tone: "ally", selected: true },
              { key: "bahia-after", label: "Bahia", troops: 5, x: 62, y: 49, tone: "ally", selected: true },
            ]}
          />
        }
        caption="Distribua todo o saldo entre seus territórios. O ataque só é liberado quando o saldo chega a zero."
      />

      <section
        className="wb-guide-regional-domain"
        aria-labelledby="guide-regional-domain-title"
      >
        <div className="wb-guide-regional-heading">
          <div>
            <p className="wb-guide-label">Domínio regional</p>
            <h3 id="guide-regional-domain-title">
              Controle a região inteira para receber o bônus.
            </h3>
          </div>
          <p>Enquanto controlar toda a região, some o bônus ao reforço base.</p>
        </div>

        <div className="wb-guide-region-table-wrap">
          <table className="wb-guide-region-table wb-guide-region-table--rules">
            <thead>
              <tr>
                <th scope="col">Região</th>
                <th scope="col">Territórios</th>
                <th scope="col">Bônus</th>
              </tr>
            </thead>
            <tbody>
              {guide.regions.map((region) => (
                <tr key={region.key} data-region={region.key}>
                  <th scope="row">
                    <span className="wb-guide-region-mark" aria-hidden="true" />
                    <span>{region.label}</span>
                  </th>
                  <td>{territoryLabel(region.territoryCount, region.territoryCount)}</td>
                  <td className="wb-guide-region-bonus">+{region.bonus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </article>
  );
}
