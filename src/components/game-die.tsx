"use client";

import Image from "next/image";
import { PLAYER_COLORS, type PlayerColor } from "@/src/lib/lobby";

export type GameDieValue = 1 | 2 | 3 | 4 | 5 | 6;

const pipPositions: Record<GameDieValue, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
};

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

function colorHex(color: PlayerColor) {
  return PLAYER_COLORS.find((item) => item.value === color)?.hex ?? "#17372d";
}

export function GameDie({
  value,
  color = "forest",
  rolling = false,
  size = "lg",
  className = "",
}: {
  value: number;
  color?: PlayerColor;
  rolling?: boolean;
  size?: keyof typeof sizeClass;
  className?: string;
}) {
  const safeValue =
    Number.isInteger(value) && value >= 1 && value <= 6
      ? (value as GameDieValue)
      : 1;

  return (
    <div
      className={`game-die relative aspect-square overflow-hidden ${sizeClass[size]} ${rolling ? "dice-roll-animation" : ""} ${className}`}
      aria-label={`Dado mostrando ${safeValue}`}
    >
      <Image
        src="/dado-brasil-hq.svg"
        alt=""
        fill
        sizes={size === "lg" ? "128px" : size === "md" ? "96px" : "64px"}
        className="object-cover"
      />
      {pipPositions[safeValue].map(([x, y], index) => (
        <span
          key={index}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50 shadow-md ${pipClass[size]}`}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            backgroundColor: colorHex(color),
          }}
        />
      ))}
    </div>
  );
}
