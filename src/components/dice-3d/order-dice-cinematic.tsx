"use client";

import { playerColorHex } from "@/src/lib/client/player-color";
import {
  ORDER_ROLL_DICE_ANIMATION_MS,
  ORDER_ROLL_RESULT_HOLD_MS,
} from "@/src/lib/game-transitions";
import type { PlayerColor } from "@/src/lib/lobby";
import { FullscreenDiceCinematic } from "./fullscreen-dice-cinematic";

export const ORDER_DICE_CINEMATIC_REPLAY_MS = ORDER_ROLL_DICE_ANIMATION_MS;
export const ORDER_DICE_CINEMATIC_RESULT_HOLD_MS = ORDER_ROLL_RESULT_HOLD_MS;
export const ORDER_DICE_CINEMATIC_VISUAL_SCALE = 0.86;

export function OrderDiceCinematic({
  roomId,
  round,
  playerId,
  value,
  rolledAt,
  color,
  onComplete,
}: {
  roomId: string;
  round: number;
  playerId: string;
  value: number;
  rolledAt: string;
  color: PlayerColor;
  onComplete: () => void;
}) {
  const seed = [
    "order-dice-cinematic",
    roomId,
    round,
    playerId,
    rolledAt,
    value,
  ].join(":");

  return (
    <FullscreenDiceCinematic
      values={[value]}
      seed={seed}
      skin="neutral"
      pipColor={playerColorHex(color)}
      label="ORDEM DE JOGO"
      replayDurationMs={ORDER_DICE_CINEMATIC_REPLAY_MS}
      resultHoldMs={ORDER_DICE_CINEMATIC_RESULT_HOLD_MS}
      visualScale={ORDER_DICE_CINEMATIC_VISUAL_SCALE}
      onComplete={onComplete}
    />
  );
}
