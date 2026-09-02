"use client";

import { useEffect } from "react";
import { GameDie } from "@/src/components/game-die";
import { preloadDiceAssets } from "@/src/lib/client/dice/dice-assets-manager";
import { validateDiceValues } from "@/src/lib/client/dice/dice-values";
import { playerColorHex } from "@/src/lib/client/player-color";
import type { PlayerColor } from "@/src/lib/lobby";
import type { GameBattle } from "@/src/lib/game-contract";

function StaticDiceSide({
  label,
  values,
  color,
  side,
}: {
  label: string;
  values: readonly number[];
  color: PlayerColor;
  side: "attack" | "defense";
}) {
  if (values.length === 0) return null;

  const dice = validateDiceValues(values);

  return (
    <div className={`battle-side battle-side--${side}`}>
      <p>{label}</p>
      <div className="battle-dice-row">
        {dice.map((value, index) => (
          <div
            className="battle-die-slot"
            key={`${side}-static-${index}-${value}`}
          >
            <GameDie value={value} color={color} className="battle-die" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BattleStaticDiceResults({
  battle,
  attackerColor = "forest",
  defenderColor = "ruby",
}: {
  battle: GameBattle;
  attackerColor?: PlayerColor;
  defenderColor?: PlayerColor;
}) {
  useEffect(() => {
    const texture =
      battle.stage === "awaiting_attacker_roll"
        ? {
            skin: "attack" as const,
            pipColor: playerColorHex(attackerColor),
          }
        : battle.stage === "awaiting_defender_roll"
          ? {
              skin: "defense" as const,
              pipColor: playerColorHex(defenderColor),
            }
          : null;

    if (!texture) return;
    void preloadDiceAssets({ texture }).catch(() => undefined);
  }, [attackerColor, battle.stage, defenderColor]);

  const hasDice = battle.attacker.length > 0 || battle.defender.length > 0;
  if (!hasDice) return null;

  return (
    <div
      className="battle-dice-grid"
      aria-live="polite"
      aria-label={`Resultados dos dados. Ataque: ${battle.attacker.join(", ") || "aguardando"}. Defesa: ${battle.defender.join(", ") || "aguardando"}.`}
    >
      <StaticDiceSide
        label="Ataque"
        values={battle.attacker}
        color={attackerColor}
        side="attack"
      />
      <StaticDiceSide
        label="Defesa"
        values={battle.defender}
        color={defenderColor}
        side="defense"
      />
    </div>
  );
}
