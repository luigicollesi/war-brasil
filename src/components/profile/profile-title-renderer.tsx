import type { CSSProperties } from "react";
import type { PublicCommanderTitleAppearance } from "@/src/lib/profile/profile-appearance-contract";
import styles from "./profile-title-renderer.module.css";

const STYLE_CLASS: Readonly<Record<string, string>> = {
  standard: styles.standard,
  "imperial-gold": styles.imperialGold,
  "blood-command": styles.bloodCommand,
  "silver-steel": styles.silverSteel,
  "night-sky": styles.nightSky,
};

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

  const styleClass = STYLE_CLASS[title.styleKey] ?? styles.standard;
  const fontClass = resolveTitleFontClass(title.fontKey);
  const textureStyle = title.textureRef
    ? ({
        "--profile-title-texture": 'url("' + title.textureRef + '")',
      } as CSSProperties)
    : undefined;

  return (
    <strong
      className={[styles.title, styleClass, fontClass, className]
        .filter(Boolean)
        .join(" ")}
      data-title-style={title.styleKey}
      data-title-font={title.fontKey}
      data-textured={title.textureRef ? "true" : "false"}
      style={textureStyle}
    >
      {title.displayText}
    </strong>
  );
}
