import { GuideBoardScene } from "@/src/components/game-guide/guide-board-scene";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
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
        <GuideBoardScene
          ariaLabel="Exemplo no mapa 2D: território próprio com quatro tropas ataca um território inimigo conectado com duas tropas"
          markers={[
            { key: "origin", label: "Origem", troops: 4, x: 42, y: 48, tone: "ally", selected: true },
            { key: "target", label: "Alvo inimigo", troops: 2, x: 61, y: 53, tone: "enemy" },
          ]}
          arrows={[
            {
              key: "attack",
              from: { x: 44, y: 48 },
              to: { x: 59, y: 52 },
              kind: "attack",
              label: "ataque",
            },
          ]}
          caption="Antes da primeira rolagem, o ataque ainda pode ser cancelado. Barreiras usam as regras da seção 08."
        />
      </div>
    </article>
  );
}
