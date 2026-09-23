import type { ProfileAppearanceRarity } from "./profile-appearance-contract";
import {
  getTitleStyleEffect,
  parseTitleStyleKey,
  titleStyleCssVariables,
} from "./title-style";

export type CommanderTitleDesignInput = Readonly<{
  rarity: ProfileAppearanceRarity;
  styleKey: string;
}>;

/**
 * Translates persisted title design metadata into a safe, allow-listed visual
 * recipe. This is the single boundary between catalog.commander_titles.style_key
 * and the renderer; database text is never interpreted as executable CSS.
 */
export function resolveCommanderTitleDesign(input: CommanderTitleDesignInput) {
  const visual = parseTitleStyleKey(input.styleKey, input.rarity);
  const outline = getTitleStyleEffect(visual, "outline");
  const shadow = getTitleStyleEffect(visual, "shadow");
  const glow = getTitleStyleEffect(visual, "glow");
  const halo = getTitleStyleEffect(visual, "halo");
  const sparkle = getTitleStyleEffect(visual, "sparkle");
  const ember = getTitleStyleEffect(visual, "ember");

  return {
    visual,
    cssVariables: titleStyleCssVariables(visual),
    effects: {
      outline,
      shadow,
      glow,
      halo,
      sparkle,
      ember,
    },
    gradientAura: {
      glow: glow?.paletteTo ? glow : null,
      halo: halo?.paletteTo ? halo : null,
    },
  } as const;
}
