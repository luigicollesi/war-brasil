import type { CSSProperties } from "react";
import type { PublicCommanderTitleAppearance } from "@/src/lib/profile/profile-appearance-contract";
import { resolveCommanderTitleDesign } from "@/src/lib/profile/title-design";
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
  const design = resolveCommanderTitleDesign(title);
  const { visual } = design;
  const { outline, shadow, glow, halo, sparkle, ember } = design.effects;

  const visualStyle = {
    ...design.cssVariables,
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
      data-title-text={title.displayText}
      data-palette={visual.palette}
      data-material={visual.material}
      data-motion={visual.motion}
      data-outline={outline ? "true" : undefined}
      data-outline-strength={outline?.strength}
      data-shadow={shadow ? "true" : undefined}
      data-shadow-strength={shadow?.strength}
      data-glow={glow ? "true" : undefined}
      data-glow-gradient={glow?.paletteTo ? "true" : undefined}
      data-glow-palette-to={glow?.paletteTo ?? undefined}
      data-glow-strength={glow?.strength}
      data-glow-motion={glow?.motion}
      data-halo={halo ? "true" : undefined}
      data-halo-gradient={halo?.paletteTo ? "true" : undefined}
      data-halo-palette-to={halo?.paletteTo ?? undefined}
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
      {design.gradientAura.halo ? (
        <span
          aria-hidden="true"
          className={[styles.auraLayer, styles.haloAura].join(" ")}
          data-aura-motion={design.gradientAura.halo.motion}
          data-aura-strength={design.gradientAura.halo.strength}
        >
          {title.displayText}
        </span>
      ) : null}
      {design.gradientAura.glow ? (
        <span
          aria-hidden="true"
          className={[styles.auraLayer, styles.glowAura].join(" ")}
          data-aura-motion={design.gradientAura.glow.motion}
          data-aura-strength={design.gradientAura.glow.strength}
        >
          {title.displayText}
        </span>
      ) : null}
      {title.displayText}
    </strong>
  );
}
