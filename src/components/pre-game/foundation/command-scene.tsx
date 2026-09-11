"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import styles from "./command-foundation.module.css";
import { COMMAND_FOUNDATION_TOKENS } from "./foundation-tokens";
import {
  normalizeCommandSceneIntent,
  type CommandSceneIntent,
} from "./scene-contract";

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

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reducedMotion;
}

function useAdaptiveMaxDpr() {
  const [maxDpr, setMaxDpr] = useState(1.25);

  useEffect(() => {
    const deviceMemory = (
      navigator as Navigator & { deviceMemory?: number }
    ).deviceMemory;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const constrainedDevice = coarsePointer || (deviceMemory !== undefined && deviceMemory <= 4);
    const cap = constrainedDevice
      ? COMMAND_FOUNDATION_TOKENS.scene.maxReducedDpr
      : COMMAND_FOUNDATION_TOKENS.scene.maxDesktopDpr;

    setMaxDpr(Math.max(1, Math.min(window.devicePixelRatio || 1, cap)));
  }, []);

  return maxDpr;
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
            sizes="(max-width: 760px) 72vw, 46vw"
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
  const reducedMotion = useReducedMotion();
  const maxDpr = useAdaptiveMaxDpr();
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

  const webglState = sceneFailed ? "fallback" : sceneReady ? "ready" : "loading";

  return (
    <div
      className={[styles.sceneHost, className].filter(Boolean).join(" ")}
      data-scene-mode={normalizedIntent.mode}
      data-webgl={webglState}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      aria-hidden="true"
    >
      <CommandSceneFallback intent={normalizedIntent} />
      {!sceneFailed ? (
        <div className={styles.canvasLayer}>
          <SceneErrorBoundary onError={handleUnavailable}>
            <CommandSceneCanvas
              intent={normalizedIntent}
              reducedMotion={reducedMotion}
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
