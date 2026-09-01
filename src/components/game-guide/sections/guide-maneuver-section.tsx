import { GuideConnection } from "@/src/components/game-guide/guide-connection";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { GuideStateChange } from "@/src/components/game-guide/guide-state-change";
import { GuideTerritoryNode } from "@/src/components/game-guide/guide-territory-node";
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
          <GuideConnection
            ariaLabel="Territórios aliados A e B conectados"
            variant="normal"
            from={<GuideTerritoryNode name="A" troops={4} tone="ally" compact />}
            to={<GuideTerritoryNode name="B" troops={2} tone="ally" compact />}
          />
          <GuideConnection
            ariaLabel="Territórios aliados B e C conectados"
            variant="normal"
            from={<GuideTerritoryNode name="B" troops={2} tone="ally" compact />}
            to={<GuideTerritoryNode name="C" troops={1} tone="ally" compact />}
          />
          <p>A → C é permitido porque B completa a cadeia própria.</p>
        </div>
      </div>

      <GuideStateChange
        ariaLabel="Exemplo de tropas disponíveis depois de já terem sido movimentadas"
        className="wb-guide-maneuver-moved-example"
        before={
          <GuideTerritoryNode
            name="Território de origem"
            troops={guide.maneuver.example.sourceTroops}
            tone="ally"
          />
        }
        action={`${guide.maneuver.example.alreadyMoved} já chegaram aqui`}
        after={
          <div className="wb-guide-maneuver-availability">
            <GuideTerritoryNode
              name="Mesmo território"
              troops={guide.maneuver.example.sourceTroops}
              tone="ally"
            />
            <strong>
              só {guide.maneuver.example.movableAfterReceiving} tropas ainda podem sair
            </strong>
          </div>
        }
        caption="Tropas recebidas por manobra não podem sair novamente nesta mesma fase."
      />

      <p className="wb-guide-inline-note">
        <strong>Barreiras.</strong> Use as regras da seção 08; o jogo escolhe a rota
        disponível com menos Barreiras.
      </p>
    </article>
  );
}
