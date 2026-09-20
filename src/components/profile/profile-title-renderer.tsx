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
  display: styles.commandDisplay,
  military: styles.military,
  stencil: styles.stencil,
  serif: styles.serif,
};

export function ProfileTitleRenderer({
  title,
  className,
}: {
  title: PublicCommanderTitleAppearance | null;
  className?: string;
}) {
  if (!title) return null;

  const styleClass = STYLE_CLASS[title.styleKey] ?? styles.standard;
  const fontClass = FONT_CLASS[title.fontKey] ?? styles.commandDisplay;
  const textureStyle = title.textureRef
    ? ({
        "--profile-title-texture": `url("${title.textureRef}")`,
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
