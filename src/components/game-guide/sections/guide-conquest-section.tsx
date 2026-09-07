import { GuideBoardScene } from "@/src/components/game-guide/guide-board-scene";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { GuideStateChange } from "@/src/components/game-guide/guide-state-change";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

export function GuideConquestSection({
  guide,
}: {
  guide: GameGuidePresentation;
}) {
  return (
    <article className="wb-guide-chapter wb-guide-chapter--split wb-guide-section--conquest">
      <div className="wb-guide-copy">
        <GuideHeading number="09" title="Tome o território">
          Derrote a última tropa defensora para conquistar. Depois, mova tropas da
          origem para ocupar o território.
        </GuideHeading>

        <p className="wb-guide-inline-note">
          <strong>Ocupação obrigatória.</strong> A origem conserva pelo menos
          {` ${guide.conquest.minimumTroopsLeftAtOrigin} tropa`} e nenhum novo ataque
          começa antes da transferência terminar.
        </p>
      </div>

      <div className="wb-guide-visual">
        <GuideStateChange
          ariaLabel="Exemplo no mapa 2D: território inimigo é conquistado e duas tropas são transferidas para ocupá-lo"
          className="wb-guide-conquest-example wb-guide-conquest-board-change"
          before={
            <GuideBoardScene
              compact
              ariaLabel="Antes da conquista"
              markers={[
                { key: "origin-before", label: "Origem", troops: 5, x: 42, y: 48, tone: "ally", selected: true },
                { key: "target-before", label: "Defesa", troops: 1, x: 61, y: 53, tone: "enemy" },
              ]}
              arrows={[
                { key: "attack-before", from: { x: 44, y: 48 }, to: { x: 59, y: 52 }, kind: "attack" },
              ]}
            />
          }
          action="conquistar + mover 2"
          after={
            <GuideBoardScene
              compact
              ariaLabel="Depois da conquista"
              markers={[
                { key: "origin-after", label: "Origem", troops: 3, x: 42, y: 48, tone: "ally" },
                { key: "target-after", label: "Conquistado", troops: 2, x: 61, y: 53, tone: "ally", selected: true },
              ]}
              arrows={[
                { key: "move-after", from: { x: 44, y: 48 }, to: { x: 59, y: 52 }, kind: "move", label: "+2" },
              ]}
            />
          }
          caption={`Mova de ${guide.conquest.minimumMove} tropa até o limite disponível na origem.`}
        />
      </div>
    </article>
  );
}
