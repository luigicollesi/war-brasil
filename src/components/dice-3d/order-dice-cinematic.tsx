"use client";

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
  assetRef,
  bodyColor,
  bodyHighlightColor,
  onComplete,
}: {
  roomId: string;
  round: number;
  playerId: string;
  value: number;
  rolledAt: string;
  color: PlayerColor;
  assetRef?: string | null;
  bodyColor?: string | null;
  bodyHighlightColor?: string | null;
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
      assetRef={assetRef}
      bodyColor={bodyColor}
      bodyHighlightColor={bodyHighlightColor}
      label="ORDEM DE JOGO"
      replayDurationMs={ORDER_DICE_CINEMATIC_REPLAY_MS}
      resultHoldMs={ORDER_DICE_CINEMATIC_RESULT_HOLD_MS}
      visualScale={ORDER_DICE_CINEMATIC_VISUAL_SCALE}
      onComplete={onComplete}
    />
  );
}
