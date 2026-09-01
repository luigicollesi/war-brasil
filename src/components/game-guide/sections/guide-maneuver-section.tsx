import { GuideConnection } from "@/src/components/game-guide/guide-connection";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { GuideRuleScale } from "@/src/components/game-guide/guide-rule-scale";
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
            No fim do turno, mova tropas entre territórios seus ligados por um
            caminho contínuo de territórios aliados. A origem sempre precisa manter
            pelo menos uma tropa.
          </GuideHeading>

          <div className="wb-guide-notes">
            <p>
              <strong>Várias manobras são permitidas.</strong> A limitação vale para
              cada tropa: uma tropa que já chegou por manobra não pode ser movida de
              novo nesta mesma fase.
            </p>
            <p>
              <strong>O caminho pode ter intermediários.</strong> Você pode sair de A
              e chegar a C usando B como passagem, desde que toda a rota pertença a
              você.
            </p>
          </div>
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
          <p>A → C é permitido porque B mantém a rota contínua.</p>
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
        caption={`Sem tropas previamente movidas, até ${guide.maneuver.example.movableBeforeReceiving} poderiam sair. O jogo desconta as tropas que já foram deslocadas e preserva ${guide.maneuver.minimumTroopsLeftAtOrigin} na origem.`}
      />

      <section className="wb-guide-maneuver-barriers">
        <div>
          <p className="wb-guide-label">Barreiras na manobra</p>
          <h3>A rota mais leve é usada automaticamente.</h3>
        </div>
        <GuideRuleScale
          ariaLabel="Efeito de Barreiras Geográficas durante a manobra"
          items={[
            {
              key: "normal",
              label: "0 barreiras",
              value: "sem perda",
              detail: "Movimentação normal entre territórios próprios.",
              tone: "success",
            },
            {
              key: "one",
              label: "1 barreira",
              value: `−${guide.maneuver.barrierLoss} tropa`,
              detail: `Mova pelo menos ${guide.maneuver.barrierMinimumTroops} tropas para atravessar.`,
              tone: "warning",
            },
            {
              key: "blocked",
              label: `${guide.maneuver.blockedBarrierCount}+ barreiras`,
              value: "rota bloqueada",
              detail: "A travessia não pode ser concluída por essa rota.",
              tone: "danger",
            },
          ]}
        />
      </section>
    </article>
  );
}
