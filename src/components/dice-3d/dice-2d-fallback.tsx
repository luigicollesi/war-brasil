"use client";

import { GameDie } from "@/src/components/game-die";
import { validateDiceValues } from "@/src/lib/client/dice/dice-values";
import type { PlayerColor } from "@/src/lib/lobby";

export function Dice2DFallback({
  values,
  color = "forest",
  className = "",
}: {
  values: readonly number[];
  color?: PlayerColor;
  className?: string;
}) {
  const safeValues = validateDiceValues(values);

  return (
    <div
      className={`flex min-h-32 items-center justify-center gap-2 ${className}`}
      aria-label={`Dados: ${safeValues.join(", ")}`}
    >
      {safeValues.map((value, index) => (
        <GameDie
          key={`${index}-${value}`}
          value={value}
          color={color}
          size="md"
        />
      ))}
    </div>
  );
}
