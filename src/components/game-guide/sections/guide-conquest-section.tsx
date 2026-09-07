import { GuideBoardScene } from "@/src/components/game-guide/guide-board-scene";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

export function GuideConquestSection({
  guide,
}: {
  guide: GameGuidePresentation;
}) {
  return (
    <article className="wb-guide-chapter wb-guide-section--conquest">
      <div className="wb-guide-core-split">
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

        <p className="wb-guide-scene-intro">
          A conquista muda o dono do território e só termina depois que as tropas de
          ocupação chegam ao novo domínio.
        </p>
      </div>

      <div
        className="wb-guide-scene-transition wb-guide-conquest-transition"
        aria-label="Antes e depois de uma conquista"
      >
        <div>
          <span>Antes</span>
          <GuideBoardScene
            ariaLabel="Antes da conquista: Goiás possui cinco tropas e a Bahia inimiga possui uma tropa"
            markers={[
              {
                key: "origin",
                label: "Goiás",
                troops: 5,
                tone: "ally",
                x: 49,
                y: 57,
                detail: "origem",
                status: "selected",
              },
              {
                key: "target",
                label: "Bahia",
                troops: 1,
                tone: "enemy",
                x: 63,
                y: 52,
                detail: "última defesa",
                status: "target",
              },
            ]}
            links={[
              {
                key: "final-attack",
                from: "origin",
                to: "target",
                kind: "attack",
                directed: true,
              },
            ]}
          />
        </div>

        <div className="wb-guide-scene-transition-arrow" aria-hidden="true">
          <strong>→</strong>
          <small>conquistar + mover 2</small>
        </div>

        <div>
          <span>Depois</span>
          <GuideBoardScene
            ariaLabel="Depois da conquista: Goiás fica com três tropas e a Bahia passa a ser aliada com duas tropas"
            markers={[
              {
                key: "origin",
                label: "Goiás",
                troops: 3,
                tone: "ally",
                x: 49,
                y: 57,
                detail: "origem preservada",
              },
              {
                key: "target",
                label: "Bahia",
                troops: 2,
                tone: "ally",
                x: 63,
                y: 52,
                detail: "novo domínio",
                status: "selected",
              },
            ]}
            links={[
              {
                key: "occupation",
                from: "origin",
                to: "target",
                kind: "maneuver",
                directed: true,
              },
            ]}
            badge={`mova de ${guide.conquest.minimumMove} tropa até o limite disponível`}
          />
        </div>
      </div>
    </article>
  );
}
