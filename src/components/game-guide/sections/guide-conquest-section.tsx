import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { GuideStateChange } from "@/src/components/game-guide/guide-state-change";
import { GuideTerritoryNode } from "@/src/components/game-guide/guide-territory-node";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

function TerritoryPair({
  originTroops,
  targetTroops,
  targetTone,
}: {
  originTroops: number;
  targetTroops: number;
  targetTone: "enemy" | "ally";
}) {
  return (
    <div className="wb-guide-territory-pair">
      <GuideTerritoryNode compact name="Origem" troops={originTroops} tone="ally" />
      <span aria-hidden="true">→</span>
      <GuideTerritoryNode compact name="Destino" troops={targetTroops} tone={targetTone} />
    </div>
  );
}

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
          ariaLabel="Exemplo de conquista: território atacante com cinco tropas conquista um território inimigo e move duas tropas"
          className="wb-guide-conquest-example"
          before={<TerritoryPair originTroops={5} targetTroops={1} targetTone="enemy" />}
          action="conquistar + mover 2"
          after={<TerritoryPair originTroops={3} targetTroops={2} targetTone="ally" />}
          caption={`Mova de ${guide.conquest.minimumMove} tropa até o limite disponível na origem.`}
        />
      </div>
    </article>
  );
}
