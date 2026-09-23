import type { ProfileAppearanceRarity } from "./profile-appearance-contract";

export const TITLE_STYLE_MAX_LENGTH = 48;

type TitlePalette = Readonly<{
  base: string;
  light: string;
  dark: string;
  accent: string;
}>;

export const TITLE_PALETTES = {
  ivory: { base: "#eee8da", light: "#fffdf4", dark: "#9d9789", accent: "#d7cfae" },
  white: { base: "#f8f9fb", light: "#ffffff", dark: "#9aa1ab", accent: "#dfe8ff" },
  black: { base: "#252729", light: "#676b70", dark: "#070809", accent: "#a1a6ad" },
  gold: { base: "#d0aa57", light: "#fff2b3", dark: "#79551e", accent: "#f4c95e" },
  silver: { base: "#c9cfcd", light: "#ffffff", dark: "#68716f", accent: "#dce7ea" },
  bronze: { base: "#ad7740", light: "#e0b477", dark: "#5f3c20", accent: "#c99456" },
  copper: { base: "#b96e4d", light: "#f0b08b", dark: "#6f3428", accent: "#d78a68" },
  red: { base: "#b53137", light: "#f07878", dark: "#5f1116", accent: "#dd4c45" },
  crimson: { base: "#a61f3d", light: "#ed6781", dark: "#4e0b20", accent: "#cf3655" },
  ember: { base: "#d55a28", light: "#ffd07c", dark: "#6e1d0d", accent: "#f1923d" },
  amber: { base: "#d99424", light: "#ffe08a", dark: "#70440f", accent: "#f2b33e" },
  green: { base: "#3f7f59", light: "#82c799", dark: "#153d29", accent: "#58a875" },
  emerald: { base: "#29956e", light: "#78e1ba", dark: "#0f4c39", accent: "#45bd8d" },
  cyan: { base: "#49b6c9", light: "#a8f0fa", dark: "#17606d", accent: "#63d7e7" },
  blue: { base: "#5179cb", light: "#9dbbf5", dark: "#263d79", accent: "#7097e5" },
  sapphire: { base: "#355fbd", light: "#91b5ff", dark: "#172d6c", accent: "#557fe0" },
  violet: { base: "#8356ba", light: "#c29aef", dark: "#412661", accent: "#9d6dd3" },
  amethyst: { base: "#7447a8", light: "#c497ef", dark: "#372050", accent: "#925ec8" },
  frost: { base: "#a9dbe8", light: "#f1fdff", dark: "#527f91", accent: "#c7f2fa" },
  night: { base: "#6879ba", light: "#d9e8ff", dark: "#31395f", accent: "#879ee0" },
  void: { base: "#473653", light: "#8d719a", dark: "#120e17", accent: "#695078" },
} as const satisfies Readonly<Record<string, TitlePalette>>;

export type TitlePaletteKey = keyof typeof TITLE_PALETTES;

export const TITLE_MATERIALS = [
  "solid",
  "matte",
  "metal",
  "satin",
  "crystal",
  "pearl",
  "neon",
  "ember",
  "frost",
  "aurora",
  "holo",
  "void",
] as const;
export type TitleMaterialKey = (typeof TITLE_MATERIALS)[number];

export const TITLE_MOTIONS = [
  "drift",
  "sheen",
  "pulse",
  "shimmer",
  "wave",
  "flow",
  "flicker",
] as const;
export type TitleMotionKey = "none" | (typeof TITLE_MOTIONS)[number];

export const TITLE_EFFECT_KINDS = [
  "outline",
  "shadow",
  "glow",
  "halo",
  "sparkle",
  "ember",
] as const;
export type TitleEffectKind = (typeof TITLE_EFFECT_KINDS)[number];

export const TITLE_EFFECT_STRENGTHS = ["soft", "medium", "strong"] as const;
export type TitleEffectStrength = (typeof TITLE_EFFECT_STRENGTHS)[number];

export const TITLE_EFFECT_MOTIONS = [
  "breathe",
  "twinkle",
  "flicker",
  "flow",
] as const;
export type TitleEffectMotion = "none" | (typeof TITLE_EFFECT_MOTIONS)[number];

const EFFECT_MOTION_ALLOWLIST: Readonly<
  Record<TitleEffectKind, ReadonlyArray<TitleEffectMotion>>
> = {
  outline: ["none"],
  shadow: ["none"],
  glow: ["none", "breathe", "flicker"],
  halo: ["none", "breathe"],
  sparkle: ["none", "twinkle", "flow"],
  ember: ["none", "flicker", "flow"],
};

const EFFECT_ORDER: Readonly<Record<TitleEffectKind, number>> = {
  outline: 0,
  shadow: 1,
  glow: 2,
  halo: 3,
  sparkle: 4,
  ember: 5,
};

const DEFAULT_STRENGTH_BY_RARITY: Readonly<
  Record<ProfileAppearanceRarity, TitleEffectStrength>
> = {
  common: "soft",
  uncommon: "soft",
  rare: "medium",
  epic: "medium",
  legendary: "strong",
};

const LEGACY_TITLE_STYLE_KEYS: Readonly<Record<string, string>> = {
  standard: "ivory-solid",
  "imperial-gold": "gold-metal_glow-gold-soft",
  "blood-command": "red-metal",
  "silver-steel": "silver-metal",
  "night-sky": "night-aurora_sparkle-white-soft",
};

const MATERIAL_COMPLEXITY: Readonly<Record<TitleMaterialKey, number>> = {
  solid: 0,
  matte: 0,
  metal: 1,
  satin: 1,
  crystal: 2,
  pearl: 1,
  neon: 2,
  ember: 2,
  frost: 2,
  aurora: 2,
  holo: 3,
  void: 2,
};

const MOTION_COMPLEXITY: Readonly<Record<TitleMotionKey, number>> = {
  none: 0,
  pulse: 1,
  drift: 2,
  sheen: 2,
  shimmer: 2,
  wave: 2,
  flow: 2,
  flicker: 2,
};

const EFFECT_COMPLEXITY: Readonly<Record<TitleEffectKind, number>> = {
  outline: 1,
  shadow: 1,
  glow: 1,
  halo: 2,
  sparkle: 2,
  ember: 2,
};

export const TITLE_RARITY_STYLE_BUDGET: Readonly<
  Record<ProfileAppearanceRarity, number>
> = {
  common: 0,
  uncommon: 2,
  rare: 4,
  epic: 7,
  legendary: 11,
};

export type ParsedTitleEffect = Readonly<{
  kind: TitleEffectKind;
  palette: TitlePaletteKey;
  strength: TitleEffectStrength;
  strengthExplicit: boolean;
  motion: TitleEffectMotion;
}>;

export type ParsedTitleStyle = Readonly<{
  sourceKey: string;
  canonicalKey: string;
  valid: boolean;
  legacy: boolean;
  palette: TitlePaletteKey;
  material: TitleMaterialKey;
  motion: TitleMotionKey;
  effects: ReadonlyArray<ParsedTitleEffect>;
  complexity: number;
  rarityCompatible: boolean;
}>;

function isPalette(value: string): value is TitlePaletteKey {
  return Object.prototype.hasOwnProperty.call(TITLE_PALETTES, value);
}

function isMaterial(value: string): value is TitleMaterialKey {
  return (TITLE_MATERIALS as readonly string[]).includes(value);
}

function isMotion(value: string): value is Exclude<TitleMotionKey, "none"> {
  return (TITLE_MOTIONS as readonly string[]).includes(value);
}

function isEffectKind(value: string): value is TitleEffectKind {
  return (TITLE_EFFECT_KINDS as readonly string[]).includes(value);
}

function isStrength(value: string): value is TitleEffectStrength {
  return (TITLE_EFFECT_STRENGTHS as readonly string[]).includes(value);
}

function isEffectMotion(value: string): value is Exclude<TitleEffectMotion, "none"> {
  return (TITLE_EFFECT_MOTIONS as readonly string[]).includes(value);
}

function fallbackStyle(
  sourceKey: string,
  rarity: ProfileAppearanceRarity,
): ParsedTitleStyle {
  return {
    sourceKey,
    canonicalKey: "ivory-solid",
    valid: false,
    legacy: false,
    palette: "ivory",
    material: "solid",
    motion: "none",
    effects: [],
    complexity: 0,
    rarityCompatible: true,
  };
}

function parseEffect(
  segment: string,
  rarity: ProfileAppearanceRarity,
): ParsedTitleEffect | null {
  const [kindToken, paletteToken, ...modifiers] = segment.split("-");
  if (!kindToken || !paletteToken || !isEffectKind(kindToken) || !isPalette(paletteToken)) {
    return null;
  }
  if (modifiers.length > 2) return null;

  let strength = DEFAULT_STRENGTH_BY_RARITY[rarity];
  let strengthExplicit = false;
  let motion: TitleEffectMotion = "none";

  for (const modifier of modifiers) {
    if (isStrength(modifier) && !strengthExplicit) {
      strength = modifier;
      strengthExplicit = true;
      continue;
    }
    if (isEffectMotion(modifier) && motion === "none") {
      motion = modifier;
      continue;
    }
    return null;
  }

  if (!EFFECT_MOTION_ALLOWLIST[kindToken].includes(motion)) return null;

  return {
    kind: kindToken,
    palette: paletteToken,
    strength,
    strengthExplicit,
    motion,
  };
}

function canonicalEffect(effect: ParsedTitleEffect) {
  const strength = effect.strengthExplicit ? `-${effect.strength}` : "";
  const motion = effect.motion === "none" ? "" : `-${effect.motion}`;
  return `${effect.kind}-${effect.palette}${strength}${motion}`;
}

function styleComplexity(
  material: TitleMaterialKey,
  motion: TitleMotionKey,
  effects: ReadonlyArray<ParsedTitleEffect>,
) {
  return (
    MATERIAL_COMPLEXITY[material] +
    MOTION_COMPLEXITY[motion] +
    effects.reduce(
      (total, effect) =>
        total +
        EFFECT_COMPLEXITY[effect.kind] +
        (effect.motion === "none" ? 0 : 1),
      0,
    )
  );
}

export function parseTitleStyleKey(
  styleKey: string,
  rarity: ProfileAppearanceRarity,
): ParsedTitleStyle {
  const sourceKey = styleKey.trim().toLowerCase();
  if (!sourceKey || sourceKey.length > TITLE_STYLE_MAX_LENGTH) {
    return fallbackStyle(sourceKey, rarity);
  }

  const expanded = LEGACY_TITLE_STYLE_KEYS[sourceKey] ?? sourceKey;
  const segments = expanded.split("_");
  const [core, ...effectSegments] = segments;
  const coreParts = core?.split("-") ?? [];

  if (coreParts.length < 2 || coreParts.length > 3) {
    return fallbackStyle(sourceKey, rarity);
  }

  const [paletteToken, materialToken, motionToken] = coreParts;
  if (!isPalette(paletteToken) || !isMaterial(materialToken)) {
    return fallbackStyle(sourceKey, rarity);
  }

  let motion: TitleMotionKey = "none";
  if (motionToken && motionToken !== "basic") {
    if (!isMotion(motionToken)) return fallbackStyle(sourceKey, rarity);
    motion = motionToken;
  }

  const effects: ParsedTitleEffect[] = [];
  const seen = new Set<TitleEffectKind>();
  for (const segment of effectSegments) {
    const effect = parseEffect(segment, rarity);
    if (!effect || seen.has(effect.kind)) return fallbackStyle(sourceKey, rarity);
    seen.add(effect.kind);
    effects.push(effect);
  }
  effects.sort((a, b) => EFFECT_ORDER[a.kind] - EFFECT_ORDER[b.kind]);

  const canonicalCore = [
    paletteToken,
    materialToken,
    motion === "none" ? null : motion,
  ]
    .filter(Boolean)
    .join("-");
  const canonicalKey = [canonicalCore, ...effects.map(canonicalEffect)].join("_");
  const complexity = styleComplexity(materialToken, motion, effects);

  return {
    sourceKey,
    canonicalKey,
    valid: true,
    legacy: expanded !== sourceKey,
    palette: paletteToken,
    material: materialToken,
    motion,
    effects,
    complexity,
    rarityCompatible: complexity <= TITLE_RARITY_STYLE_BUDGET[rarity],
  };
}

export function getTitleStyleEffect(
  style: ParsedTitleStyle,
  kind: TitleEffectKind,
) {
  return style.effects.find((effect) => effect.kind === kind) ?? null;
}

function effectPalette(
  style: ParsedTitleStyle,
  kind: TitleEffectKind,
  fallback: TitlePaletteKey,
) {
  const effect = getTitleStyleEffect(style, kind);
  return TITLE_PALETTES[effect?.palette ?? fallback];
}

export function titleStyleCssVariables(
  style: ParsedTitleStyle,
): Readonly<Record<string, string>> {
  const palette = TITLE_PALETTES[style.palette];

  return {
    "--profile-title-base": palette.base,
    "--profile-title-light": palette.light,
    "--profile-title-dark": palette.dark,
    "--profile-title-accent": palette.accent,
    "--profile-title-outline": effectPalette(style, "outline", style.palette).base,
    "--profile-title-shadow": effectPalette(style, "shadow", "black").dark,
    "--profile-title-glow": effectPalette(style, "glow", style.palette).accent,
    "--profile-title-halo": effectPalette(style, "halo", style.palette).accent,
    "--profile-title-sparkle": effectPalette(style, "sparkle", "white").light,
    "--profile-title-ember": effectPalette(style, "ember", "ember").accent,
  };
}
