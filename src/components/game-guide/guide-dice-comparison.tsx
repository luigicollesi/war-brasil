import type { ReactNode } from "react";
import { GameDie } from "@/src/components/game-die";
import type { PlayerColor } from "@/src/lib/lobby";

export type GuideDiceComparisonTone =
  | "attack-loss"
  | "defense-loss"
  | "neutral";

export type GuideDiceComparisonRow = {
  key: string;
  attack: number;
  defense: number;
  result: ReactNode;
  tone?: GuideDiceComparisonTone;
};

function comparator(attack: number, defense: number) {
  if (attack > defense) return ">";
  if (attack < defense) return "<";
  return "=";
}

export function GuideDiceComparison({
  rows,
  ariaLabel,
  attackLabel = "Ataque",
  defenseLabel = "Defesa",
  attackColor = "ruby",
  defenseColor = "ocean",
  unpairedAttack = [],
  unpairedDefense = [],
  caption,
  className = "",
}: {
  rows: readonly GuideDiceComparisonRow[];
  ariaLabel: string;
  attackLabel?: ReactNode;
  defenseLabel?: ReactNode;
  attackColor?: PlayerColor;
  defenseColor?: PlayerColor;
  unpairedAttack?: readonly number[];
  unpairedDefense?: readonly number[];
  caption?: ReactNode;
  className?: string;
}) {
  if (
    rows.length === 0 &&
    unpairedAttack.length === 0 &&
    unpairedDefense.length === 0
  ) {
    return null;
  }

  return (
    <figure
      className={`wb-guide-dice-comparison ${className}`.trim()}
      aria-label={ariaLabel}
    >
      <div className="wb-guide-dice-comparison-head" aria-hidden="true">
        <strong>{attackLabel}</strong>
        <span />
        <strong>{defenseLabel}</strong>
        <span>Resultado</span>
      </div>

      <div className="wb-guide-dice-comparison-rows">
        {rows.map((row) => (
          <div
            key={row.key}
            className="wb-guide-dice-comparison-row"
            data-tone={row.tone ?? "neutral"}
          >
            <GameDie value={row.attack} color={attackColor} size="sm" />
            <strong className="wb-guide-dice-comparator" aria-hidden="true">
              {comparator(row.attack, row.defense)}
            </strong>
            <GameDie value={row.defense} color={defenseColor} size="sm" />
            <span className="wb-guide-dice-result">{row.result}</span>
          </div>
        ))}

        {unpairedAttack.map((value, index) => (
          <div
            key={`attack-extra-${index}`}
            className="wb-guide-dice-comparison-row wb-guide-dice-comparison-row--unpaired"
          >
            <GameDie value={value} color={attackColor} size="sm" />
            <strong className="wb-guide-dice-comparator" aria-hidden="true">—</strong>
            <span className="wb-guide-dice-empty" aria-hidden="true" />
            <span className="wb-guide-dice-result">Sem comparação</span>
          </div>
        ))}

        {unpairedDefense.map((value, index) => (
          <div
            key={`defense-extra-${index}`}
            className="wb-guide-dice-comparison-row wb-guide-dice-comparison-row--unpaired"
          >
            <span className="wb-guide-dice-empty" aria-hidden="true" />
            <strong className="wb-guide-dice-comparator" aria-hidden="true">—</strong>
            <GameDie value={value} color={defenseColor} size="sm" />
            <span className="wb-guide-dice-result">Sem comparação</span>
          </div>
        ))}
      </div>

      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
