import type { CSSProperties } from "react";
import type { PublicCommanderTitleAppearance } from "@/src/lib/profile/profile-appearance-contract";
import {
  getTitleStyleEffect,
  parseTitleStyleKey,
  titleStyleCssVariables,
} from "@/src/lib/profile/title-style";
import styles from "./profile-title-renderer.module.css";

const FONT_CLASS: Readonly<Record<string, string>> = {
  "command-display": styles.commandDisplay,
  "command-mono": styles.commandMono,
  "military-stencil": styles.militaryStencil,
  imperial: styles.imperial,
  "tactical-tech": styles.tacticalTech,
  propaganda: styles.propaganda,
  ceremonial: styles.ceremonial,

  // Legacy aliases remain readable while catalog rows migrate to canonical keys.
  display: styles.commandDisplay,
  military: styles.military,
  stencil: styles.militaryStencil,
  serif: styles.serif,
};

function resolveTitleFontClass(fontKey: string) {
  return FONT_CLASS[fontKey] ?? styles.commandDisplay;
}

export function ProfileTitleRenderer({
  title,
  className,
}: {
  title: PublicCommanderTitleAppearance | null;
  className?: string;
}) {
  if (!title) return null;

  const fontClass = resolveTitleFontClass(title.fontKey);
  const visual = parseTitleStyleKey(title.styleKey, title.rarity);
  const outline = getTitleStyleEffect(visual, "outline");
  const shadow = getTitleStyleEffect(visual, "shadow");
  const glow = getTitleStyleEffect(visual, "glow");
  const halo = getTitleStyleEffect(visual, "halo");
  const sparkle = getTitleStyleEffect(visual, "sparkle");
  const ember = getTitleStyleEffect(visual, "ember");

  const visualStyle = {
    ...titleStyleCssVariables(visual),
    ...(title.textureRef
      ? { "--profile-title-texture": 'url("' + title.textureRef + '")' }
      : {}),
  } as CSSProperties;

  return (
    <strong
      className={[styles.title, fontClass, className].filter(Boolean).join(" ")}
      data-title-style={visual.canonicalKey}
      data-title-style-source={title.styleKey}
      data-title-style-valid={visual.valid ? "true" : "false"}
      data-title-style-budget={visual.rarityCompatible ? "within" : "over"}
      data-title-font={title.fontKey}
      data-title-rarity={title.rarity}
      data-palette={visual.palette}
      data-material={visual.material}
      data-motion={visual.motion}
      data-outline={outline ? "true" : undefined}
      data-outline-strength={outline?.strength}
      data-shadow={shadow ? "true" : undefined}
      data-shadow-strength={shadow?.strength}
      data-glow={glow ? "true" : undefined}
      data-glow-strength={glow?.strength}
      data-glow-motion={glow?.motion}
      data-halo={halo ? "true" : undefined}
      data-halo-strength={halo?.strength}
      data-halo-motion={halo?.motion}
      data-sparkle={sparkle ? "true" : undefined}
      data-sparkle-strength={sparkle?.strength}
      data-sparkle-motion={sparkle?.motion}
      data-ember={ember ? "true" : undefined}
      data-ember-strength={ember?.strength}
      data-ember-motion={ember?.motion}
      data-textured={title.textureRef ? "true" : "false"}
      style={visualStyle}
    >
      {title.displayText}
    </strong>
  );
}
