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
  DiceVector3,
  PredeterminedDiceRoll as PredeterminedRoll,
} from "@/src/lib/client/dice/types";
import { DicePreSimulation } from "./dice-pre-simulation";
import { DiceTrajectoryReplay } from "./dice-trajectory-replay";

export function PredeterminedDiceRoll({
  values,
  seed,
  textures,
  preparingFallback = null,
  failureFallback = null,
  launchOffset,
  playbackDurationMs,
  initialElapsedMs,
  visualScale = 1,
  dockPositions,
  dockScale,
  dockDurationMs,
  skipAnimation,
  onComplete,
  onError,
}: {
  values: readonly DiceValue[];
  seed: string;
  textures: DiceFaceTextureSet;
  preparingFallback?: ReactNode;
  failureFallback?: ReactNode;
  launchOffset?: DiceVector3;
  playbackDurationMs?: number;
  initialElapsedMs?: number;
  visualScale?: number;
  dockPositions?: readonly DiceVector3[];
  dockScale?: number;
  dockDurationMs?: number;
  skipAnimation?: boolean;
  onComplete?: () => void;
  onError?: () => void;
}) {
  const [roll, setRoll] = useState<PredeterminedRoll | null>(null);
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

  const fail = useCallback(() => {
    setFailed(true);
    onError?.();
  }, [onError]);

  const handleComplete = useCallback(
    (trajectory: DicePhysicsTrajectory) => {
      try {
        setRoll(buildPredeterminedDiceRoll(values, trajectory));
      } catch {
        fail();
      }
    },
    [fail, values],
  );

  if (failed) return failureFallback;

  if (!roll) {
    return (
      <Suspense fallback={preparingFallback}>
        <DicePreSimulation
          count={values.length}
          seed={seed}
          launchOffset={launchOffset}
          onComplete={handleComplete}
          onError={fail}
        />
      </Suspense>
    );
  }

  return (
    <DiceTrajectoryReplay
      roll={roll}
      geometry={geometry}
      textures={textures}
      playbackDurationMs={playbackDurationMs}
      initialElapsedMs={initialElapsedMs}
      visualScale={visualScale}
      dockPositions={dockPositions}
      dockScale={dockScale}
      dockDurationMs={dockDurationMs}
      skipAnimation={skipAnimation}
      onComplete={onComplete}
    />
  );
}
