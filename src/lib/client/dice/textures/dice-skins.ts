import type { DiceSkin } from "../types";

export type DiceProceduralPalette = Readonly<{
  top: string;
  bottom: string;
  edge: string;
  highlight: string;
}>;

/**
 * Network-independent fallback used when a cosmetic WebP is unavailable.
 * These colors are presentation only; they never participate in dice rules,
 * physics, RNG or result resolution.
 */
export const DICE_PROCEDURAL_PALETTES: Readonly<
  Record<DiceSkin, DiceProceduralPalette>
> = {
  neutral: {
    top: "#9a7a25",
    bottom: "#5f4914",
    edge: "#d5b85b",
    highlight: "rgba(255, 244, 194, 0.30)",
  },
  attack: {
    top: "#9b2f36",
    bottom: "#54151b",
    edge: "#d46969",
    highlight: "rgba(255, 218, 213, 0.24)",
  },
  defense: {
    top: "#28619a",
    bottom: "#153754",
    edge: "#70a8d7",
    highlight: "rgba(220, 239, 255, 0.26)",
  },
};

export const DEFAULT_DICE_PIP_COLOR = "#f7f2e8";
export const DEFAULT_DICE_TEXTURE_RESOLUTION = 512;
