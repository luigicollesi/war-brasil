"use client";

import { useMemo } from "react";
import { validateDiceValues } from "@/src/lib/client/dice/dice-values";
import type { DiceValue } from "@/src/lib/client/dice/types";
import { playerColorHex } from "@/src/lib/client/player-color";
import type { GameBattle } from "@/src/lib/game-contract";
import type { PlayerColor } from "@/src/lib/lobby";
import { FullscreenDiceCinematic } from "./fullscreen-dice-cinematic";

export type BattleDiceCinematicSide = "attack" | "defense";

export const BATTLE_DICE_CINEMATIC_TOTAL_MS = 2_300;
export const BATTLE_DICE_CINEMATIC_REPLAY_MS = 1_800;
export const BATTLE_DICE_CINEMATIC_VISUAL_SCALE = 0.86;

function cinematicSeed(
  battle: GameBattle,
  side: BattleDiceCinematicSide,
  values: readonly DiceValue[],
) {
  return [
    "battle-dice-cinematic",
    battle.attackerPlayerId,
    battle.attackerTerritoryId,
    battle.defenderPlayerId,
    battle.defenderTerritoryId,
    side,
    battle.stageStartedAt,
    values.join("-"),
  ].join(":");
}

export function BattleDiceCinematic({
  battle,
  side,
  color,
  onComplete,
}: {
  battle: GameBattle;
  side: BattleDiceCinematicSide;
  color: PlayerColor;
  onComplete: () => void;
}) {
  const values = useMemo(
    () =>
      validateDiceValues(
        side === "attack" ? battle.attacker : battle.defender,
      ),
    [battle.attacker, battle.defender, side],
  );
  const seed = useMemo(
    () => cinematicSeed(battle, side, values),
    [battle, side, values],
  );

  return (
    <FullscreenDiceCinematic
      values={values}
      seed={seed}
      skin={side}
      pipColor={playerColorHex(color)}
      label={side === "attack" ? "ATAQUE" : "DEFESA"}
      startedAt={battle.stageStartedAt}
      totalDurationMs={BATTLE_DICE_CINEMATIC_TOTAL_MS}
      replayDurationMs={BATTLE_DICE_CINEMATIC_REPLAY_MS}
      visualScale={BATTLE_DICE_CINEMATIC_VISUAL_SCALE}
      onComplete={onComplete}
    />
  );
}
