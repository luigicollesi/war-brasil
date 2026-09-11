import type { CSSProperties, ReactNode } from "react";
import styles from "./command-foundation.module.css";
import { CommandScene } from "./command-scene";
import { COMMAND_FOUNDATION_TOKENS } from "./foundation-tokens";
import {
  COMMAND_SCENE_MODE_LABELS,
  normalizeCommandSceneIntent,
  type CommandSceneIntent,
} from "./scene-contract";

type CommandShellProps = {
  intent: CommandSceneIntent;
  children: ReactNode;
  className?: string;
  chrome?: boolean;
  sectionLabel?: string;
  style?: CSSProperties;
};

function foundationStyle(style?: CSSProperties): CSSProperties {
  const { color, depth, material, spacing } = COMMAND_FOUNDATION_TOKENS;
  return {
    "--command-void": color.void,
    "--command-coal": color.coal,
    "--command-military": color.military,
    "--command-military-raised": color.militaryRaised,
    "--command-brass": color.brass,
    "--command-brass-bright": color.brassBright,
    "--command-conflict": color.conflict,
    "--command-ivory": color.ivory,
    "--command-muted": color.muted,
    "--command-panel-blur": `${material.panelBlurPx}px`,
    "--command-space-sm": `${spacing.sm}px`,
    "--command-space-md": `${spacing.md}px`,
    "--command-space-lg": `${spacing.lg}px`,
    "--command-z-atmosphere": depth.atmosphere,
    "--command-z-content": depth.content,
    "--command-z-chrome": depth.chrome,
    ...style,
  } as CSSProperties;
}

export function CommandShell({
  intent,
  children,
  className,
  chrome = true,
  sectionLabel,
  style,
}: CommandShellProps) {
  const normalizedIntent = normalizeCommandSceneIntent(intent);
  const modeLabel = sectionLabel ?? COMMAND_SCENE_MODE_LABELS[normalizedIntent.mode];

  return (
    <div
      className={[styles.shell, className].filter(Boolean).join(" ")}
      style={foundationStyle(style)}
      data-command-scene-mode={normalizedIntent.mode}
    >
      <CommandScene intent={normalizedIntent} />
      <div className={styles.atmosphere} aria-hidden="true" />
      {chrome ? (
        <div className={styles.shellChrome} aria-hidden="true">
          <div className={styles.brandLockup}>
            <span className={styles.brandSeal}>WB</span>
            <span>
              <small>COMANDO TERRITORIAL</small>
              <strong>WAR BRASIL</strong>
            </span>
          </div>
          <div className={styles.modeRail}>
            <span>SISTEMA // COMANDO</span>
            <strong>{modeLabel}</strong>
          </div>
        </div>
      ) : null}
      <div className={styles.shellContent}>{children}</div>
    </div>
  );
}
