import { GuideBoardScene } from "@/src/components/game-guide/guide-board-scene";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

export function GuideManeuverSection({
  guide,
}: {
  guide: GameGuidePresentation;
}) {
  return (
    <article className="wb-guide-chapter wb-guide-section--maneuver">
      <div className="wb-guide-core-split">
        <div className="wb-guide-copy">
          <GuideHeading number="12" title="Reposicione suas tropas">
            Na manobra, mova tropas entre seus territórios por uma cadeia própria
            contínua. A origem conserva pelo menos {guide.maneuver.minimumTroopsLeftAtOrigin} tropa.
          </GuideHeading>

          <p className="wb-guide-inline-note">
            <strong>Tropas recebidas.</strong> Tropas que chegaram por manobra não podem
            sair novamente nesta mesma fase.
          </p>
        </div>

        <div className="wb-guide-visual wb-guide-maneuver-route">
          <GuideBoardScene
            ariaLabel="Exemplo no mapa 2D: uma manobra atravessa três territórios aliados conectados"
            markers={[
              { key: "a", label: "Origem A", troops: 5, x: 31, y: 60, tone: "ally", selected: true },
              { key: "b", label: "Ponte B", troops: 2, x: 50, y: 49, tone: "ally" },
              { key: "c", label: "Destino C", troops: 3, x: 73, y: 35, tone: "ally", moved: true },
            ]}
            arrows={[
              { key: "route-a-b", from: { x: 39, y: 55 }, to: { x: 48, y: 49 }, kind: "route" },
              { key: "route-b-c", from: { x: 52, y: 48 }, to: { x: 61, y: 44 }, kind: "move", label: "+2 tropas" },
            ]}
            caption={`A → C é permitido porque B completa a cadeia própria. Depois de receber ${guide.maneuver.example.alreadyMoved} tropas, C ainda pode liberar somente as tropas que já estavam disponíveis antes da manobra.`}
          />
        </div>
      </div>

      <div className="wb-guide-maneuver-availability-summary">
        <p>
          <strong>{guide.maneuver.example.movableBeforeReceiving}</strong>
          <span>podiam sair da origem antes de receber tropas</span>
        </p>
        <span aria-hidden="true">→</span>
        <p>
          <strong>{guide.maneuver.example.movableAfterReceiving}</strong>
          <span>continuam disponíveis depois que {guide.maneuver.example.alreadyMoved} chegam</span>
        </p>
      </div>

      <p className="wb-guide-inline-note">
        <strong>Barreiras.</strong> Use as regras da seção 08; o jogo escolhe a rota
        disponível com menos Barreiras.
      </p>
    </article>
  );
}
