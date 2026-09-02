"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import type { PlayerColor } from "@/src/lib/lobby";
import { getSharedRoundedDieGeometry } from "@/src/lib/client/dice/dice-assets-manager";
import { validateDiceValues } from "@/src/lib/client/dice/dice-values";
import { DICE_PHYSICS } from "@/src/lib/client/dice/physics/dice-physics-config";
import type {
  DiceFaceTextureSet,
  DiceSkin,
  DiceValue,
  DiceVector3,
} from "@/src/lib/client/dice/types";
import { Dice2DFallback } from "./dice-2d-fallback";
import { Die3D } from "./die-3d";
import { PredeterminedDiceStage } from "./predetermined-dice-stage";
import {
  useDiceWebGLSupport,
  useReducedDiceMotion,
} from "./use-dice-presentation-capabilities";
import { useDiceFaceTextures } from "./use-dice-face-textures";

function layoutForDice(count: number): DiceVector3[] {
  if (count === 1) return [[0, 0, 0]];
  if (count === 2) return [[-0.72, 0, 0], [0.72, 0, 0]];
  return [[-1.12, 0, 0.08], [0, 0, -0.08], [1.12, 0, 0.08]];
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
        size: DICE_PHYSICS.dieSize,
        radius: DICE_PHYSICS.dieRadius,
        segments: DICE_PHYSICS.dieSegments,
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
          size={DICE_PHYSICS.dieSize}
          radius={DICE_PHYSICS.dieRadius}
          yaw={0.22 + index * 0.18}
        />
      ))}

      <mesh
        position={[0, DICE_PHYSICS.floorTopY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry
          args={[
            DICE_PHYSICS.trayHalfWidth * 2,
            DICE_PHYSICS.trayHalfDepth * 2,
          ]}
        />
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
  animationSeed,
  className = "",
}: {
  values: readonly number[];
  skin?: DiceSkin;
  pipColor?: string;
  fallbackColor?: PlayerColor;
  animationSeed?: string;
  className?: string;
}) {
  const safeValues = useMemo(() => validateDiceValues(values), [values]);
  const webglSupported = useDiceWebGLSupport();
  const reducedMotion = useReducedDiceMotion();
  const { textures, error } = useDiceFaceTextures({ skin, pipColor });
  const resolvedSeed =
    animationSeed?.trim() || `dice-scene:${skin}:${safeValues.join("-")}`;

  if (!webglSupported || reducedMotion || error || !textures) {
    return (
      <Dice2DFallback
        values={safeValues}
        color={fallbackColor}
        className={className}
      />
    );
  }

  const staticFallback = (
    <StaticDiceStage values={safeValues} textures={textures} />
  );

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
        <PredeterminedDiceStage
          key={`${resolvedSeed}:${safeValues.join("-")}`}
          values={safeValues}
          seed={resolvedSeed}
          textures={textures}
          fallback={staticFallback}
        />
      </Canvas>
    </div>
  );
}
