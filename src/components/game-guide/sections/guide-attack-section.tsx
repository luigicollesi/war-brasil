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
          ariaLabel="Exemplo no mapa 2D: Goiás, com quatro tropas, ataca a Bahia, com duas tropas"
          markers={[
            {
              key: "origin",
              label: "Goiás",
              troops: 4,
              tone: "ally",
              x: 49,
              y: 57,
              detail: "seu território",
              status: "selected",
            },
            {
              key: "target",
              label: "Bahia",
              troops: 2,
              tone: "enemy",
              x: 63,
              y: 52,
              detail: "território inimigo",
              status: "target",
            },
          ]}
          links={[
            {
              key: "attack",
              from: "origin",
              to: "target",
              kind: "attack",
              directed: true,
            },
          ]}
          badge={`${guide.attack.normalMinimumTroops}+ tropas para iniciar um ataque normal`}
          caption="Antes da primeira rolagem, o ataque ainda pode ser cancelado. Barreiras usam as regras da seção 08."
        />
      </div>
    </article>
  );
}
