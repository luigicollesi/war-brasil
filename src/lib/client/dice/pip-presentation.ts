import type { PlayerColor } from "@/src/lib/lobby";
import { playerColorHex } from "@/src/lib/client/player-color";
import { DICE_VISUAL_PIP_COLOR } from "./visual-config";

const DARK_SURFACE_PIP_COLOR = "#ffffff";
const GAMEPLAY_DARK_SURFACE_LIGHTEN_RATIO = 0.46;

function lightenHexColor(hex: string, ratio: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;

  const packed = Number.parseInt(match[1], 16);
  const channels = [
    (packed >> 16) & 0xff,
    (packed >> 8) & 0xff,
    packed & 0xff,
  ];

  const lightened = channels.map((channel) =>
    Math.round(channel + (255 - channel) * ratio),
  );

  return `#${lightened
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function storeDicePipColor(dark: boolean) {
  return dark ? DARK_SURFACE_PIP_COLOR : DICE_VISUAL_PIP_COLOR;
}

export function gameplayDicePipColor(
  playerColor: PlayerColor,
  dark: boolean,
) {
  const base = playerColorHex(playerColor);
  return dark
    ? lightenHexColor(base, GAMEPLAY_DARK_SURFACE_LIGHTEN_RATIO)
    : base;
}
