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
          Quando a última tropa defensora é derrotada, o território muda de dono.
          Antes de atacar novamente, você precisa mover tropas da origem para
          ocupar a conquista.
        </GuideHeading>

        <div className="wb-guide-notes">
          <p>
            <strong>Quanto mover.</strong> Escolha de
            {` ${guide.conquest.minimumMove} tropa`} até todas as tropas disponíveis,
            deixando pelo menos {guide.conquest.minimumTroopsLeftAtOrigin} na origem.
          </p>
          <p>
            <strong>Ocupação obrigatória.</strong> Nenhum novo ataque pode começar
            enquanto essa transferência estiver pendente.
          </p>
        </div>
      </div>

      <div className="wb-guide-visual">
        <GuideStateChange
          ariaLabel="Exemplo de conquista: território atacante com cinco tropas conquista um território inimigo e move duas tropas"
          className="wb-guide-conquest-example"
          before={<TerritoryPair originTroops={5} targetTroops={1} targetTone="enemy" />}
          action="conquistar + mover 2"
          after={<TerritoryPair originTroops={3} targetTroops={2} targetTone="ally" />}
          caption="A quantidade transferida é uma escolha sua dentro do limite disponível na origem."
        />
      </div>
    </article>
  );
}
