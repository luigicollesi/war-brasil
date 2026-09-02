"use client";

import { playerColorHex } from "@/src/lib/client/player-color";
import type { PlayerColor } from "@/src/lib/lobby";
import { FullscreenDiceCinematic } from "./fullscreen-dice-cinematic";

export const ORDER_DICE_CINEMATIC_TOTAL_MS = 2_300;
export const ORDER_DICE_CINEMATIC_REPLAY_MS = 1_800;
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
      startedAt={rolledAt}
      totalDurationMs={ORDER_DICE_CINEMATIC_TOTAL_MS}
      replayDurationMs={ORDER_DICE_CINEMATIC_REPLAY_MS}
      visualScale={ORDER_DICE_CINEMATIC_VISUAL_SCALE}
      onComplete={onComplete}
    />
  );
}
