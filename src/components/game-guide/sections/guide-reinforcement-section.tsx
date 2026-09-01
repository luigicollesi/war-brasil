import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { GuideRuleScale } from "@/src/components/game-guide/guide-rule-scale";
import { GuideStateChange } from "@/src/components/game-guide/guide-state-change";
import { GuideTerritoryNode } from "@/src/components/game-guide/guide-territory-node";
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
            Você recebe tropas pela quantidade de territórios que controla e pelas
            regiões completas. Distribua todo o saldo em territórios que já são
            seus antes de começar a atacar.
          </GuideHeading>

          <p className="wb-guide-inline-note">
            <strong>Troca obrigatória pendente?</strong> Resolva a troca de cartas
            antes de posicionar qualquer reforço.
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
        ariaLabel="Exemplo de distribuição de seis reforços entre territórios próprios"
        className="wb-guide-reinforcement-example"
        before={
          <div className="wb-guide-territory-group">
            <GuideTerritoryNode name="Goiás" troops={2} tone="ally" />
            <GuideTerritoryNode name="Bahia" troops={1} tone="ally" />
          </div>
        }
        action="+6 reforços"
        after={
          <div className="wb-guide-territory-group">
            <GuideTerritoryNode name="Goiás" troops={4} tone="ally" />
            <GuideTerritoryNode name="Bahia" troops={5} tone="ally" />
          </div>
        }
        caption="Você escolhe como dividir o saldo. O ataque só é liberado quando todos os reforços forem posicionados."
      />

      <section
        className="wb-guide-regional-domain"
        aria-labelledby="guide-regional-domain-title"
      >
        <div className="wb-guide-regional-heading">
          <div>
            <p className="wb-guide-label">Domínio regional</p>
            <h3 id="guide-regional-domain-title">
              Regiões completas aumentam o reforço do turno.
            </h3>
          </div>
          <p>
            O bônus é somado ao reforço base em toda fase de reforço enquanto você
            controlar todos os territórios da região.
          </p>
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
