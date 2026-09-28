"use client";

import { useEffect } from "react";
import { GameDie } from "@/src/components/game-die";
import {
  preloadDiceAssets,
  preloadDiceSourceImage,
} from "@/src/lib/client/dice/dice-assets-manager";
import { validateDiceValues } from "@/src/lib/client/dice/dice-values";
import { gameplayDicePipColor } from "@/src/lib/client/dice/pip-presentation";
import { DICE_VISUAL_TEXTURE_RESOLUTION } from "@/src/lib/client/dice/visual-config";
import type { PlayerColor } from "@/src/lib/lobby";
import type { GameBattle } from "@/src/lib/game-contract";

function StaticDiceSide({
  label,
  values,
  color,
  side,
  assetRef,
  dicePipDark,
  dicePipCompact,
}: {
  label: string;
  values: readonly number[];
  color: PlayerColor;
  side: "attack" | "defense";
  assetRef?: string | null;
  dicePipDark: boolean;
  dicePipCompact: boolean;
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
            <GameDie
              value={value}
              color={color}
              skin={side}
              assetRef={assetRef}
              pipColor={gameplayDicePipColor(color, dicePipDark)}
              pipCompact={dicePipCompact}
              className="battle-die"
            />
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
  attackAssetRef,
  defenseAssetRef,
  attackBodyColor,
  defenseBodyColor,
  attackDicePipDark = false,
  attackDicePipCompact = false,
  defenseDicePipDark = false,
  defenseDicePipCompact = false,
}: {
  battle: GameBattle;
  attackerColor?: PlayerColor;
  defenderColor?: PlayerColor;
  attackAssetRef?: string | null;
  defenseAssetRef?: string | null;
  attackBodyColor?: string | null;
  defenseBodyColor?: string | null;
  attackDicePipDark?: boolean;
  attackDicePipCompact?: boolean;
  defenseDicePipDark?: boolean;
  defenseDicePipCompact?: boolean;
}) {
  useEffect(() => {
    for (const assetRef of [attackAssetRef, defenseAssetRef]) {
      if (!assetRef) continue;
      void preloadDiceSourceImage(assetRef).catch(() => undefined);
    }
  }, [attackAssetRef, defenseAssetRef]);

  useEffect(() => {
    const texture =
      battle.stage === "awaiting_attacker_roll"
        ? {
            skin: "attack" as const,
            pipColor: gameplayDicePipColor(attackerColor, attackDicePipDark),
            pipCompact: attackDicePipCompact,
            assetRef: attackAssetRef,
            bodyColor: attackBodyColor,
            resolution: DICE_VISUAL_TEXTURE_RESOLUTION,
          }
        : battle.stage === "awaiting_defender_roll"
          ? {
              skin: "defense" as const,
              pipColor: gameplayDicePipColor(defenderColor, defenseDicePipDark),
              pipCompact: defenseDicePipCompact,
              assetRef: defenseAssetRef,
              bodyColor: defenseBodyColor,
              resolution: DICE_VISUAL_TEXTURE_RESOLUTION,
            }
          : null;

    if (!texture) return;
    void preloadDiceAssets({ texture }).catch(() => undefined);
  }, [
    attackAssetRef,
    attackBodyColor,
    attackDicePipCompact,
    attackDicePipDark,
    attackerColor,
    battle.stage,
    defenseAssetRef,
    defenseBodyColor,
    defenseDicePipCompact,
    defenseDicePipDark,
    defenderColor,
  ]);

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
        assetRef={attackAssetRef}
        dicePipDark={attackDicePipDark}
        dicePipCompact={attackDicePipCompact}
      />
      <StaticDiceSide
        label="Defesa"
        values={battle.defender}
        color={defenderColor}
        side="defense"
        assetRef={defenseAssetRef}
        dicePipDark={defenseDicePipDark}
        dicePipCompact={defenseDicePipCompact}
      />
    </div>
  );
}
