import type { DiceSkin } from "../types";

export const DICE_SKIN_SOURCES: Readonly<Record<DiceSkin, string>> = {
  neutral: "/dado-brasil-hq.svg",
  attack: "/dado-ataque-vermelho-hq.svg",
  defense: "/dado-defesa-azul-hq.svg",
};

export const DEFAULT_DICE_PIP_COLOR = "#f7f2e8";
export const DEFAULT_DICE_TEXTURE_RESOLUTION = 512;
