import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import styles from "./command-foundation.module.css";
import { CommandScene } from "./command-scene";
import { COMMAND_FOUNDATION_TOKENS } from "./foundation-tokens";
import type { ShowcaseScenePayload } from "./pre-game-command-runtime";
import {
  COMMAND_SCENE_MODE_LABELS,
  normalizeCommandSceneIntent,
  type CommandSceneIntent,
  type CommandSceneState,
} from "./scene-contract";

type CommandShellProps = {
  intent: CommandSceneIntent;
  children: ReactNode;
  className?: string;
  chrome?: boolean;
  showModeRail?: boolean;
  sectionLabel?: string;
  style?: CSSProperties;
  showcaseScene?: ShowcaseScenePayload | null;
  onSceneStateChange?: (state: CommandSceneState) => void;
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
    "--command-content-top": "clamp(88px, 10vw, 124px)",
    "--command-content-inline": "clamp(20px, 4vw, 64px)",
    "--command-content-bottom": "max(24px, env(safe-area-inset-bottom))",
    ...style,
  } as CSSProperties;
}

export function CommandShell({
  intent,
  children,
  className,
  chrome = true,
  showModeRail = true,
  sectionLabel,
  style,
  showcaseScene = null,
  onSceneStateChange,
}: CommandShellProps) {
  const normalizedIntent = normalizeCommandSceneIntent(intent);
  const modeLabel = sectionLabel ?? COMMAND_SCENE_MODE_LABELS[normalizedIntent.mode];

  return (
    <div
      className={[styles.shell, className].filter(Boolean).join(" ")}
      style={foundationStyle(style)}
      data-command-scene-mode={normalizedIntent.mode}
    >
      <CommandScene
        intent={normalizedIntent}
        showcaseScene={showcaseScene}
        onStateChange={onSceneStateChange}
      />
      <div className={styles.atmosphere} data-command-atmosphere aria-hidden="true" />
      {chrome ? (
        <div className={styles.shellChrome} data-command-chrome aria-hidden="true">
          <div className={styles.brandLockup}>
            <span className={styles.brandSeal}>
              <Image
                src="/icone.png"
                alt=""
                width={34}
                height={34}
                priority
                style={{ width: 34, height: 34, objectFit: "contain" }}
              />
            </span>
            <span>
              <small>COMANDO TERRITORIAL</small>
              <strong>BELLUM CIVILE</strong>
            </span>
          </div>
          {showModeRail ? (
            <div className={styles.modeRail}>
              <span>SISTEMA // COMANDO</span>
              <strong>{modeLabel}</strong>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={styles.shellContent}>{children}</div>
    </div>
  );
}