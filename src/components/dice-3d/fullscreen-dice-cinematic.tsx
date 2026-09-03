"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { createPortal } from "react-dom";
import { PCFShadowMap, type OrthographicCamera } from "three";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { validateDiceValues } from "@/src/lib/client/dice/dice-values";
import { installDice3DDependencyWarningFilter } from "@/src/lib/client/dice/install-3d-dependency-warning-filter";
import { DICE_PHYSICS } from "@/src/lib/client/dice/physics/dice-physics-config";
import type { DiceSkin, DiceValue } from "@/src/lib/client/dice/types";
import styles from "./battle-dice-cinematic.module.css";
import { PredeterminedDiceRoll } from "./predetermined-dice-roll";
import {
  useDiceWebGLSupport,
  useReducedDiceMotion,
} from "./use-dice-presentation-capabilities";
import { useDiceFaceTextures } from "./use-dice-face-textures";

installDice3DDependencyWarningFilter();

const MIN_PRESENTATION_REMAINING_MS = 280;
const PORTRAIT_ASPECT_THRESHOLD = 0.82;
const MAX_DICE_TEXTURE_ANISOTROPY = 8;
const CAMERA_HEIGHT = 10;

function presentationElapsedMs(startedAt: string, totalDurationMs: number) {
  const startedAtMs = Date.parse(startedAt);
  if (!Number.isFinite(startedAtMs)) return totalDurationMs;
  return Math.min(totalDurationMs, Math.max(0, Date.now() - startedAtMs));
}

function TopDownCameraRig() {
  const size = useThree((state) => state.size);
  const set = useThree((state) => state.set);
  const get = useThree((state) => state.get);
  const cameraRef = useRef<OrthographicCamera>(null);
  const aspect = size.height > 0 ? size.width / size.height : 16 / 9;
  const portrait = aspect < PORTRAIT_ASPECT_THRESHOLD;
  const compact = !portrait && aspect < 1.2;
  const viewHeight = portrait ? 10.2 : compact ? 8.8 : 8.2;
  const halfHeight = viewHeight / 2;
  const halfWidth = halfHeight * aspect;
  const mode = `${portrait ? "portrait" : compact ? "compact" : "landscape"}:${aspect.toFixed(3)}`;

  useLayoutEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    const previousCamera = get().camera;
    set({ camera });

    return () => {
      if (get().camera === camera) set({ camera: previousCamera });
    };
  }, [get, mode, set]);

  return (
    <orthographicCamera
      key={mode}
      ref={cameraRef}
      position={[0, CAMERA_HEIGHT, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      left={-halfWidth}
      right={halfWidth}
      top={halfHeight}
      bottom={-halfHeight}
      near={0.1}
      far={30}
    />
  );
}

function CinematicShadowSurface() {
  return (
    <mesh
      position={[0, DICE_PHYSICS.floorTopY + 0.001, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[6.8, 6.8]} />
      <shadowMaterial transparent opacity={0.25} depthWrite={false} />
    </mesh>
  );
}

function CinematicScene({
  values,
  seed,
  skin,
  pipColor,
  replayDurationMs,
  initialElapsedMs,
  visualScale,
  onError,
}: {
  values: readonly DiceValue[];
  seed: string;
  skin: DiceSkin;
  pipColor?: string;
  replayDurationMs: number;
  initialElapsedMs: number;
  visualScale: number;
  onError: () => void;
}) {
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);
  const textureState = useDiceFaceTextures({ skin, pipColor });
  const portrait =
    size.height > 0 && size.width / size.height < PORTRAIT_ASPECT_THRESHOLD;

  useEffect(() => {
    if (textureState.error) onError();
  }, [onError, textureState.error]);

  useEffect(() => {
    if (!textureState.textures) return;

    const anisotropy = Math.max(
      1,
      Math.min(
        MAX_DICE_TEXTURE_ANISOTROPY,
        gl.capabilities.getMaxAnisotropy(),
      ),
    );

    for (const texture of Object.values(textureState.textures)) {
      if (texture.anisotropy === anisotropy) continue;
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    }
  }, [gl, textureState.textures]);

  if (!textureState.textures || textureState.error) return null;

  return (
    <>
      <TopDownCameraRig />
      <ambientLight intensity={1.05} />
      <directionalLight
        position={[3.4, 7.8, 4.1]}
        intensity={3.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.00035}
      />
      <directionalLight position={[-4.2, 3.8, -2]} intensity={0.8} />
      <CinematicShadowSurface />
      <group rotation={[0, portrait ? Math.PI / 2 : 0, 0]}>
        <PredeterminedDiceRoll
          values={values}
          seed={seed}
          textures={textureState.textures}
          preparingFallback={null}
          failureFallback={null}
          playbackDurationMs={replayDurationMs}
          initialElapsedMs={Math.min(initialElapsedMs, replayDurationMs)}
          visualScale={visualScale}
          onError={onError}
        />
      </group>
    </>
  );
}

export function FullscreenDiceCinematic({
  values,
  seed,
  skin,
  pipColor,
  label,
  startedAt,
  totalDurationMs,
  replayDurationMs,
  visualScale = 0.86,
  onComplete,
}: {
  values: readonly number[];
  seed: string;
  skin: DiceSkin;
  pipColor?: string;
  label: string;
  startedAt: string;
  totalDurationMs: number;
  replayDurationMs: number;
  visualScale?: number;
  onComplete: () => void;
}) {
  const webglSupported = useDiceWebGLSupport();
  const reducedMotion = useReducedDiceMotion();
  const completedRef = useRef(false);
  const [initialElapsedMs] = useState(() =>
    presentationElapsedMs(startedAt, totalDurationMs),
  );
  const safeValues = useMemo(() => validateDiceValues(values), [values]);
  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);
  const remainingMs = Math.max(0, totalDurationMs - initialElapsedMs);
  const shouldSkip =
    !webglSupported ||
    reducedMotion ||
    safeValues.length === 0 ||
    remainingMs < MIN_PRESENTATION_REMAINING_MS;

  useEffect(() => {
    if (shouldSkip) return;

    const gameRoot = document.querySelector<HTMLElement>(".game-runtime > div");
    if (!gameRoot) return;

    const alreadyInert = gameRoot.hasAttribute("inert");
    if (!alreadyInert) gameRoot.setAttribute("inert", "");

    return () => {
      if (!alreadyInert) gameRoot.removeAttribute("inert");
    };
  }, [shouldSkip]);

  useEffect(() => {
    if (shouldSkip) {
      const timeoutId = window.setTimeout(finish, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const timeoutId = window.setTimeout(finish, remainingMs);
    return () => window.clearTimeout(timeoutId);
  }, [finish, remainingMs, shouldSkip]);

  if (typeof document === "undefined" || shouldSkip) return null;

  return createPortal(
    <div
      className={styles.root}
      aria-hidden="true"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.preventDefault()}
    >
      <div className={styles.backdrop} />
      <div className={styles.label}>{label}</div>
      <div className={styles.canvas}>
        <Canvas
          orthographic
          shadows={{ type: PCFShadowMap }}
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ position: [0, CAMERA_HEIGHT, 0], zoom: 100 }}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
        >
          <CinematicScene
            values={safeValues}
            seed={seed}
            skin={skin}
            pipColor={pipColor}
            replayDurationMs={replayDurationMs}
            initialElapsedMs={initialElapsedMs}
            visualScale={visualScale}
            onError={finish}
          />
        </Canvas>
      </div>
    </div>,
    document.body,
  );
}
