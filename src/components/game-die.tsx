"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import type { DieRollAnimation } from "@/src/lib/game-battle-display";
import {
  DICE_PIP_LAYOUT_PERCENT,
  normalizeDiceValue,
} from "@/src/lib/client/dice/pip-layout";
import type { DiceValue } from "@/src/lib/client/dice/types";
import { playerColorHex } from "@/src/lib/client/player-color";
import type { PlayerColor } from "@/src/lib/lobby";

export type GameDieValue = DiceValue;

const sizeClass = {
  sm: "w-16 rounded-2xl",
  md: "w-24 rounded-2xl",
  lg: "w-32 rounded-3xl",
} as const;

const pipClass = {
  sm: "h-2.5 w-2.5",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
} as const;

export function GameDie({
  value,
  color = "forest",
  rolling = false,
  rollAnimation,
  size = "lg",
  className = "",
}: {
  value: number;
  color?: PlayerColor;
  rolling?: boolean;
  rollAnimation?: DieRollAnimation;
  size?: keyof typeof sizeClass;
  className?: string;
}) {
  const safeValue = normalizeDiceValue(value);
  const animationClass = rolling
    ? rollAnimation
      ? "battle-die-roll-animation"
      : "dice-roll-animation"
    : "";
  const rollStyle = rollAnimation
    ? ({
        "--die-roll-angle": `${rollAnimation.direction * rollAnimation.rotations * 360}deg`,
        "--die-roll-duration": `${rollAnimation.durationMs}ms`,
        "--die-roll-delay": `${rollAnimation.delayMs}ms`,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className={`game-die relative aspect-square overflow-hidden ${sizeClass[size]} ${animationClass} ${className}`}
      data-rolling={rolling ? "true" : "false"}
      style={rollStyle}
      aria-label={`Dado mostrando ${safeValue}`}
    >
      <Image
        src="/dado-brasil-hq.svg"
        alt=""
        fill
        sizes={size === "lg" ? "128px" : size === "md" ? "96px" : "64px"}
        className="object-cover"
      />
      {DICE_PIP_LAYOUT_PERCENT[safeValue].map(([x, y], index) => (
        <span
          key={index}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50 shadow-md ${pipClass[size]}`}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            backgroundColor: playerColorHex(color),
          }}
        />
      ))}
    </div>
  );
}
