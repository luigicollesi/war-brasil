"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Component,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { installDice3DDependencyWarningFilter } from "@/src/lib/client/dice/install-3d-dependency-warning-filter";
import styles from "./command-foundation.module.css";
import { COMMAND_FOUNDATION_TOKENS } from "./foundation-tokens";
import {
  normalizeCommandSceneIntent,
  type CommandSceneIntent,
} from "./scene-contract";

installDice3DDependencyWarningFilter();

const CommandSceneCanvas = dynamic(
  () => import("./command-scene-canvas").then((module) => module.CommandSceneCanvas),
  { ssr: false, loading: () => null },
);

type CommandSceneProps = {
  intent: CommandSceneIntent;
  className?: string;
};

type SceneErrorBoundaryProps = {
  children: ReactNode;
  onError: () => void;
};

type SceneErrorBoundaryState = {
  failed: boolean;
};

let cachedWebGLAvailability: boolean | undefined;

class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function detectWebGLAvailability() {
  if (cachedWebGLAvailability !== undefined) return cachedWebGLAvailability;

  try {
    const canvas = document.createElement("canvas");
    cachedWebGLAvailability = Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
  } catch {
    cachedWebGLAvailability = false;
  }

  return cachedWebGLAvailability;
}

function subscribeWebGLAvailability() {
  return () => undefined;
}

function useWebGLAvailability() {
  return useSyncExternalStore(
    subscribeWebGLAvailability,
    detectWebGLAvailability,
    () => true,
  );
}

function CommandSceneFallback({ intent }: { intent: ReturnType<typeof normalizeCommandSceneIntent> }) {
  const globeVisible = intent.mode === "entrance" || intent.focus === "earth";

  return (
    <div className={styles.sceneFallback} aria-hidden="true">
      <div
        className={styles.fallbackGlobe}
        data-visible={globeVisible ? "true" : "false"}
      >
        <span />
        <span />
        <span />
      </div>
      <div className={styles.fallbackTable}>
        <span className={styles.fallbackTableRim} />
        <span className={styles.fallbackCrownRingA} />
        <span className={styles.fallbackCrownRingB} />
        <span className={styles.fallbackCrownRingC} />
        <div className={styles.fallbackBrazil}>
          <Image
            src="/war-brasil-42.production.svg"
            alt=""
            fill
            unoptimized
            loading="eager"
            sizes="(max-width: 900px) 72vw, 46vw"
          />
        </div>
      </div>
    </div>
  );
}

export function CommandScene({ intent, className }: CommandSceneProps) {
  const normalizedIntent = useMemo(
    () => normalizeCommandSceneIntent(intent),
    [intent],
  );
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const coarsePointer = useMediaQuery("(pointer: coarse)");
  const compactScene = useMediaQuery("(max-width: 900px)");
  const webglAvailable = useWebGLAvailability();
  const maxDpr =
    reducedMotion || coarsePointer || compactScene
      ? COMMAND_FOUNDATION_TOKENS.scene.maxReducedDpr
      : COMMAND_FOUNDATION_TOKENS.scene.maxDesktopDpr;
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);

  const handleReady = useCallback(() => {
    setSceneFailed(false);
    setSceneReady(true);
  }, []);

  const handleUnavailable = useCallback(() => {
    setSceneReady(false);
    setSceneFailed(true);
  }, []);

  const sceneUnavailable = sceneFailed || !webglAvailable;
  const webglState = sceneUnavailable ? "fallback" : sceneReady ? "ready" : "loading";

  return (
    <div
      className={[styles.sceneHost, className].filter(Boolean).join(" ")}
      data-scene-mode={normalizedIntent.mode}
      data-webgl={webglState}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-compact-scene={compactScene ? "true" : "false"}
      aria-hidden="true"
    >
      <CommandSceneFallback intent={normalizedIntent} />
      {!sceneUnavailable ? (
        <div className={styles.canvasLayer}>
          <SceneErrorBoundary onError={handleUnavailable}>
            <CommandSceneCanvas
              intent={normalizedIntent}
              reducedMotion={reducedMotion}
              compact={compactScene}
              maxDpr={maxDpr}
              onReady={handleReady}
              onUnavailable={handleUnavailable}
            />
          </SceneErrorBoundary>
        </div>
      ) : null}
    </div>
  );
}