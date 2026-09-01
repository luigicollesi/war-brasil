import Image from "next/image";
import { GuideFlow } from "@/src/components/game-guide/guide-flow";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

export function GuideSetupSection({
  guide,
}: {
  guide: GameGuidePresentation;
}) {
  return (
    <article className="wb-guide-chapter wb-guide-chapter--split wb-guide-section--setup">
      <div className="wb-guide-copy">
        <GuideHeading number="01" title="Prepare o Brasil">
          Os {guide.territoryCount} territórios são embaralhados e distribuídos
          da forma mais equilibrada possível. Cada um começa com
          {` ${guide.setup.initialTroopsPerTerritory} tropa`}.
        </GuideHeading>

        <p className="wb-guide-inline-note">
          <strong>2 a 6 jogadores.</strong> A distribuição inicial é automática: você
          começa a partida com parte do mapa já sob seu controle.
        </p>
      </div>

      <div className="wb-guide-visual wb-guide-setup-stage">
        <div className="wb-guide-map-mini">
          <Image
            src="/war-brasil-42.production.svg"
            alt="Mapa do Brasil dividido em territórios"
            width={440}
            height={440}
            loading="lazy"
          />
          <span>{guide.territoryCount} territórios</span>
          <small>{guide.regionCount} regiões</small>
        </div>

        <GuideFlow
          compact
          className="wb-guide-setup-flow"
          ariaLabel="Preparação dos territórios"
          steps={[
            {
              key: "territories",
              eyebrow: "Mapa",
              label: `${guide.territoryCount} territórios`,
              detail: "embaralhados",
            },
            {
              key: "distribution",
              eyebrow: "Distribuição",
              label: "Entre jogadores",
              detail: "de forma equilibrada",
            },
            {
              key: "troops",
              eyebrow: "Início",
              label: `${guide.setup.initialTroopsPerTerritory} tropa`,
              detail: "em cada território",
              tone: "accent",
            },
          ]}
        />
      </div>
    </article>
  );
}
