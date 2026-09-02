"use client";

import {
  Suspense,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSharedRoundedDieGeometry } from "@/src/lib/client/dice/dice-assets-manager";
import { buildPredeterminedDiceRoll } from "@/src/lib/client/dice/physics/build-predetermined-roll";
import { DICE_PHYSICS } from "@/src/lib/client/dice/physics/dice-physics-config";
import type {
  DiceFaceTextureSet,
  DicePhysicsTrajectory,
  DiceValue,
  PredeterminedDiceRoll,
} from "@/src/lib/client/dice/types";
import { DicePreSimulation } from "./dice-pre-simulation";
import { DiceTrajectoryReplay } from "./dice-trajectory-replay";
import { DiceTraySurface } from "./dice-tray-surface";

export function PredeterminedDiceStage({
  values,
  seed,
  textures,
  fallback,
}: {
  values: readonly DiceValue[];
  seed: string;
  textures: DiceFaceTextureSet;
  fallback: ReactNode;
}) {
  const [roll, setRoll] = useState<PredeterminedDiceRoll | null>(null);
  const [failed, setFailed] = useState(false);
  const geometry = useMemo(
    () =>
      getSharedRoundedDieGeometry({
        size: DICE_PHYSICS.dieSize,
        radius: DICE_PHYSICS.dieRadius,
        segments: DICE_PHYSICS.dieSegments,
      }),
    [],
  );

  const handleComplete = useCallback(
    (trajectory: DicePhysicsTrajectory) => {
      try {
        setRoll(buildPredeterminedDiceRoll(values, trajectory));
      } catch {
        setFailed(true);
      }
    },
    [values],
  );
  const handleError = useCallback(() => setFailed(true), []);

  if (failed) return fallback;

  if (!roll) {
    return (
      <Suspense fallback={fallback}>
        <DicePreSimulation
          count={values.length}
          seed={seed}
          onComplete={handleComplete}
          onError={handleError}
        />
      </Suspense>
    );
  }

  return (
    <>
      <ambientLight intensity={1.35} />
      <directionalLight
        position={[3.5, 5.5, 4.5]}
        intensity={3.2}
        castShadow
      />
      <directionalLight position={[-4, 2.5, 2]} intensity={1.1} />
      <DiceTrajectoryReplay
        roll={roll}
        geometry={geometry}
        textures={textures}
      />
      <DiceTraySurface />
    </>
  );
}
