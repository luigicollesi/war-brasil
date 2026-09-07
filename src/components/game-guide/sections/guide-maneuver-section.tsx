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
        </div>

        <div className="wb-guide-visual wb-guide-maneuver-route">
          <GuideBoardScene
            ariaLabel="Rota de manobra no mapa 2D passando por três territórios aliados: Goiás, Minas Gerais e São Paulo"
            markers={[
              {
                key: "a",
                label: "Goiás",
                troops: 4,
                tone: "ally",
                x: 48,
                y: 54,
                detail: "origem A",
                status: "selected",
              },
              {
                key: "b",
                label: "Minas Gerais",
                troops: 2,
                tone: "ally",
                x: 58,
                y: 61,
                detail: "ponte B",
              },
              {
                key: "c",
                label: "São Paulo",
                troops: 1,
                tone: "ally",
                x: 54,
                y: 71,
                detail: "destino C",
                status: "target",
              },
            ]}
            links={[
              { key: "a-b", from: "a", to: "b", kind: "maneuver", directed: true },
              { key: "b-c", from: "b", to: "c", kind: "maneuver", directed: true },
            ]}
            badge="A → B → C · cadeia própria"
            caption="A → C é permitido porque B mantém a rota inteira dentro dos seus territórios."
          />
        </div>
      </div>

      <div className="wb-guide-maneuver-lock-scene">
        <div>
          <p className="wb-guide-label">Tropas recém-movidas</p>
          <h3>Quem chegou nesta manobra não pode sair de novo.</h3>
          <p>
            O território continua com todas as tropas, mas parte delas já foi
            movimentada nesta fase e fica indisponível como nova origem.
          </p>
        </div>

        <GuideBoardScene
          ariaLabel={`Território com ${guide.maneuver.example.sourceTroops} tropas, das quais ${guide.maneuver.example.alreadyMoved} chegaram durante a manobra e não podem sair novamente`}
          markers={[
            {
              key: "moved",
              label: "Minas Gerais",
              troops: guide.maneuver.example.sourceTroops,
              tone: "ally",
              x: 58,
              y: 61,
              detail: `${guide.maneuver.example.alreadyMoved} chegaram nesta fase`,
              status: "moved",
            },
          ]}
          badge={`só ${guide.maneuver.example.movableAfterReceiving} tropas ainda podem sair`}
          caption="Tropas recebidas por manobra não podem sair novamente nesta mesma fase."
        />
      </div>

      <p className="wb-guide-inline-note">
        <strong>Barreiras.</strong> Use as regras da seção 08; o jogo escolhe a rota
        disponível com menos Barreiras.
      </p>
    </article>
  );
}
