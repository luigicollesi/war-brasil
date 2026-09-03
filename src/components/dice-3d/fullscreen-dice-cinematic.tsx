"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { createPortal } from "react-dom";
import { PCFShadowMap, type PerspectiveCamera } from "three";
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

const CINEMATIC_PRE_ROLL_MS = 250;
const PORTRAIT_ASPECT_THRESHOLD = 0.82;
const MAX_DICE_TEXTURE_ANISOTROPY = 8;
const CAMERA_HEIGHT = 20;
const CAMERA_FOV = 50;
const PORTRAIT_CAMERA_FOV = 54;

function TopDownCameraRig() {
  const size = useThree((state) => state.size);
  const set = useThree((state) => state.set);
  const get = useThree((state) => state.get);
  const cameraRef = useRef<PerspectiveCamera>(null);
  const aspect = size.height > 0 ? size.width / size.height : 16 / 9;
  const portrait = aspect < PORTRAIT_ASPECT_THRESHOLD;
  const fov = portrait ? PORTRAIT_CAMERA_FOV : CAMERA_FOV;
  const mode = `${portrait ? "portrait" : "landscape"}:${aspect.toFixed(3)}`;

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
    <perspectiveCamera
      key={mode}
      ref={cameraRef}
      position={[0, CAMERA_HEIGHT, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      fov={fov}
      aspect={aspect}
      near={0.1}
      far={60}
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
  visualScale,
  onError,
}: {
  values: readonly DiceValue[];
  seed: string;
  skin: DiceSkin;
  pipColor?: string;
  replayDurationMs: number;
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
          initialElapsedMs={0}
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
  totalDurationMs: number;
  replayDurationMs: number;
  visualScale?: number;
  onComplete: () => void;
}) {
  const webglSupported = useDiceWebGLSupport();
  const reducedMotion = useReducedDiceMotion();
  const completedRef = useRef(false);
  const [readySeed, setReadySeed] = useState<string | null>(null);
  const safeValues = useMemo(() => validateDiceValues(values), [values]);
  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);
  const shouldSkip =
    !webglSupported || reducedMotion || safeValues.length === 0;
  const playbackReady = readySeed === seed;

  useEffect(() => {
    completedRef.current = false;
  }, [seed]);

  useEffect(() => {
    if (shouldSkip) return;

    const timeoutId = window.setTimeout(
      () => setReadySeed(seed),
      CINEMATIC_PRE_ROLL_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [seed, shouldSkip]);

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

    const timeoutId = window.setTimeout(finish, totalDurationMs);
    return () => window.clearTimeout(timeoutId);
  }, [finish, seed, shouldSkip, totalDurationMs]);

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
          shadows={{ type: PCFShadowMap }}
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{
            position: [0, CAMERA_HEIGHT, 0],
            fov: CAMERA_FOV,
            near: 0.1,
            far: 60,
          }}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
        >
          {playbackReady ? (
            <CinematicScene
              values={safeValues}
              seed={seed}
              skin={skin}
              pipColor={pipColor}
              replayDurationMs={replayDurationMs}
              visualScale={visualScale}
              onError={finish}
            />
          ) : null}
        </Canvas>
      </div>
    </div>,
    document.body,
  );
}
