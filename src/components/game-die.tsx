"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import type { DieRollAnimation } from "@/src/lib/game-battle-display";
import {
  DICE_PIP_LAYOUT_PERCENT,
  normalizeDiceValue,
} from "@/src/lib/client/dice/pip-layout";
import { DICE_PROCEDURAL_PALETTES } from "@/src/lib/client/dice/textures/dice-skins";
import type { DiceSkin, DiceValue } from "@/src/lib/client/dice/types";
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
  skin = "neutral",
  assetRef,
  rolling = false,
  rollAnimation,
  size = "lg",
  className = "",
}: {
  value: number;
  color?: PlayerColor;
  skin?: DiceSkin;
  assetRef?: string | null;
  rolling?: boolean;
  rollAnimation?: DieRollAnimation;
  size?: keyof typeof sizeClass;
  className?: string;
}) {
  const requestedAsset = assetRef?.trim() || null;
  const [failedAsset, setFailedAsset] = useState<string | null>(null);
  const imageSource =
    requestedAsset && failedAsset !== requestedAsset ? requestedAsset : null;
  const safeValue = normalizeDiceValue(value);
  const palette = DICE_PROCEDURAL_PALETTES[skin];
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
      data-dice-skin={skin}
      data-dice-source={imageSource ? "cosmetic" : "procedural"}
      style={rollStyle}
      aria-label={`Dado mostrando ${safeValue}`}
    >
      {imageSource ? (
        <Image
          src={imageSource}
          alt=""
          fill
          unoptimized
          sizes={size === "lg" ? "128px" : size === "md" ? "96px" : "64px"}
          className="object-cover"
          onError={() => setFailedAsset(imageSource)}
        />
      ) : (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: `linear-gradient(145deg, ${palette.top}, ${palette.bottom})`,
            }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-[5%] rounded-[20%] border-2"
            style={{ borderColor: palette.edge }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 28% 22%, ${palette.highlight}, rgba(255,255,255,0) 58%)`,
            }}
          />
        </>
      )}
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
