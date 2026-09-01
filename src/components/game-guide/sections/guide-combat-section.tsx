import { GameDie } from "@/src/components/game-die";
import { GuideDiceComparison } from "@/src/components/game-guide/guide-dice-comparison";
import { GuideFlow } from "@/src/components/game-guide/guide-flow";
import { GuideHeading } from "@/src/components/game-guide/guide-heading";
import { GuideRuleScale } from "@/src/components/game-guide/guide-rule-scale";
import type { GameGuidePresentation } from "@/src/lib/game-guide-presentation";

function bandLabel(minimumTroops: number, maximumTroops: number | null) {
  if (maximumTroops === null) return `${minimumTroops}+ tropas`;
  return minimumTroops === maximumTroops
    ? `${minimumTroops} tropa${minimumTroops === 1 ? "" : "s"}`
    : `${minimumTroops}–${maximumTroops} tropas`;
}

function dice(count: number, color: "ruby" | "ocean") {
  return Array.from({ length: count }, (_, index) => (
    <GameDie key={index} value={5} color={color} size="sm" />
  ));
}

export function GuideCombatSection({
  guide,
}: {
  guide: GameGuidePresentation;
}) {
  const example = guide.combat.example;

  return (
    <article className="wb-guide-chapter wb-guide-section--combat">
      <GuideHeading number="07" title="Role os dados">
        Compare os maiores dados em pares. Empates favorecem a defesa.
      </GuideHeading>

      <GuideFlow
        compact
        ariaLabel="Sequência de uma batalha"
        className="wb-guide-combat-flow"
        steps={[
          { key: "attack", label: "Atacante rola" },
          { key: "defense", label: "Defensor rola" },
          { key: "compare", label: "Ordenar e comparar", tone: "accent" },
          { key: "losses", label: "Aplicar perdas" },
        ]}
      />

      <div className="wb-guide-combat-scales">
        <section>
          <p className="wb-guide-label">Dados do ataque normal</p>
          <GuideRuleScale
            ariaLabel="Quantidade de dados do atacante por tropas na origem"
            items={guide.attack.normalDiceBands.map((band) => ({
              key: `${band.minimumTroops}-${band.maximumTroops ?? "plus"}`,
              label: bandLabel(band.minimumTroops, band.maximumTroops),
              value: dice(band.diceCount, "ruby"),
            }))}
          />
          <small>Uma tropa fica na origem.</small>
        </section>

        <section>
          <p className="wb-guide-label">Dados da defesa</p>
          <GuideRuleScale
            ariaLabel="Quantidade de dados do defensor por tropas no território"
            items={guide.defense.diceBands.map((band) => ({
              key: `${band.minimumTroops}-${band.maximumTroops ?? "plus"}`,
              label: bandLabel(band.minimumTroops, band.maximumTroops),
              value: dice(band.diceCount, "ocean"),
            }))}
          />
          <small>A defesa pode usar sua última tropa.</small>
        </section>
      </div>

      <div className="wb-guide-combat-example">
        <div>
          <p className="wb-guide-label">Exemplo</p>
          <h3>Maior contra maior.</h3>
        </div>

        <GuideDiceComparison
          ariaLabel="Exemplo: ataque seis contra defesa cinco, ataque quatro contra defesa quatro e um dado atacante sem comparação"
          rows={example.comparisons.map((comparison) => ({
            key: comparison.key,
            attack: comparison.attack,
            defense: comparison.defense,
            result:
              comparison.loser === "defender"
                ? "Defesa −1"
                : "Ataque −1",
            tone:
              comparison.loser === "defender"
                ? "defense-loss"
                : "attack-loss",
          }))}
          unpairedAttack={example.unpairedAttack}
          unpairedDefense={example.unpairedDefense}
          caption={`Resultado: ataque −${example.attackerLosses}, defesa −${example.defenderLosses}. Dados sem par não causam perda.`}
        />
      </div>
    </article>
  );
}
