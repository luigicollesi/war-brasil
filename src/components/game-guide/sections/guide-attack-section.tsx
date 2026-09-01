import { GuideConnection } from "@/src/components/game-guide/guide-connection";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { GuideTerritoryNode } from "@/src/components/game-guide/guide-territory-node";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

export function GuideAttackSection({
  guide,
}: {
  guide: GameGuidePresentation;
}) {
  return (
    <article className="wb-guide-chapter wb-guide-chapter--split wb-guide-section--attack">
      <div className="wb-guide-copy">
        <GuideHeading number="06" title="Escolha seu ataque">
          Ataque um território inimigo conectado usando um território seu com pelo
          menos {guide.attack.normalMinimumTroops} tropas.
        </GuideHeading>

        <div className="wb-guide-notes">
          <p>
            <strong>Origem.</strong> Uma tropa sempre permanece nela. Anomalias podem
            impedir um território de iniciar ataques.
          </p>
          <p>
            <strong>Depois de rolar.</strong> Conclua a batalha. Se conquistar, ocupe
            o território antes de iniciar outro ataque.
          </p>
        </div>
      </div>

      <div className="wb-guide-visual wb-guide-attack-example">
        <GuideConnection
          directed
          ariaLabel="Território próprio com quatro tropas atacando um território inimigo conectado com duas tropas"
          from={<GuideTerritoryNode compact name="Origem" troops={4} tone="ally" />}
          to={<GuideTerritoryNode compact name="Inimigo" troops={2} tone="enemy" />}
          caption="Antes da primeira rolagem, o ataque ainda pode ser cancelado. Barreiras usam as regras da seção 08."
        />
      </div>
    </article>
  );
}
