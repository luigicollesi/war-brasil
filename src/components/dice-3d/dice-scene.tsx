"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo, useSyncExternalStore } from "react";
import type { PlayerColor } from "@/src/lib/lobby";
import { getSharedRoundedDieGeometry } from "@/src/lib/client/dice/dice-assets-manager";
import { validateDiceValues } from "@/src/lib/client/dice/dice-values";
import type {
  DiceFaceTextureSet,
  DiceSkin,
  DiceValue,
  DiceVector3,
} from "@/src/lib/client/dice/types";
import { supportsDiceWebGL } from "@/src/lib/client/dice/webgl-support";
import { Dice2DFallback } from "./dice-2d-fallback";
import { Die3D } from "./die-3d";
import { useDiceFaceTextures } from "./use-dice-face-textures";

const DIE_SIZE = 1;
const DIE_RADIUS = 0.1;
const DIE_SEGMENTS = 8;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function layoutForDice(count: number): DiceVector3[] {
  if (count === 1) return [[0, 0, 0]];
  if (count === 2) return [[-0.72, 0, 0], [0.72, 0, 0]];
  return [[-1.12, 0, 0.08], [0, 0, -0.08], [1.12, 0, 0.08]];
}

function subscribeNoop() {
  return () => {};
}

function subscribeReducedMotion(onStoreChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function reducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function serverFalseSnapshot() {
  return false;
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    serverFalseSnapshot,
  );
}

function useWebGLSupport() {
  return useSyncExternalStore(
    subscribeNoop,
    supportsDiceWebGL,
    serverFalseSnapshot,
  );
}

function StaticDiceStage({
  values,
  textures,
}: {
  values: readonly DiceValue[];
  textures: DiceFaceTextureSet;
}) {
  const positions = layoutForDice(values.length);
  const geometry = useMemo(
    () =>
      getSharedRoundedDieGeometry({
        size: DIE_SIZE,
        radius: DIE_RADIUS,
        segments: DIE_SEGMENTS,
      }),
    [],
  );

  return (
    <>
      <ambientLight intensity={1.35} />
      <directionalLight
        position={[3.5, 5.5, 4.5]}
        intensity={3.2}
        castShadow
      />
      <directionalLight position={[-4, 2.5, 2]} intensity={1.1} />

      {values.map((value, index) => (
        <Die3D
          key={`${index}-${value}`}
          geometry={geometry}
          textures={textures}
          topValue={value}
          position={positions[index]}
          size={DIE_SIZE}
          radius={DIE_RADIUS}
          yaw={0.22 + index * 0.18}
        />
      ))}

      <mesh position={[0, -0.58, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5.5, 3.3]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>
    </>
  );
}

export function DiceScene({
  values,
  skin = "neutral",
  pipColor,
  fallbackColor = "forest",
  className = "",
}: {
  values: readonly number[];
  skin?: DiceSkin;
  pipColor?: string;
  fallbackColor?: PlayerColor;
  className?: string;
}) {
  const safeValues = useMemo(() => validateDiceValues(values), [values]);
  const webglSupported = useWebGLSupport();
  const reducedMotion = useReducedMotion();
  const { textures, error } = useDiceFaceTextures({ skin, pipColor });

  if (!webglSupported || reducedMotion || error || !textures) {
    return (
      <Dice2DFallback
        values={safeValues}
        color={fallbackColor}
        className={className}
      />
    );
  }

  return (
    <div
      className={`relative h-40 w-full min-w-0 overflow-hidden ${className}`}
      aria-label={`Dados 3D: ${safeValues.join(", ")}`}
    >
      <Canvas
        aria-hidden="true"
        shadows
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{
          position: [0, 2.9, safeValues.length === 3 ? 5.6 : 4.8],
          fov: safeValues.length === 3 ? 34 : 31,
        }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        <StaticDiceStage values={safeValues} textures={textures} />
      </Canvas>
    </div>
  );
}
