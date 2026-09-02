"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  Group,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from "three";
import type {
  DiceFaceTextureSet,
  PredeterminedDiceRoll,
} from "@/src/lib/client/dice/types";
import { DICE_PHYSICS } from "@/src/lib/client/dice/physics/dice-physics-config";
import { DieVisual } from "./die-visual";

export function DiceTrajectoryReplay({
  roll,
  geometry,
  textures,
  onComplete,
}: {
  roll: PredeterminedDiceRoll;
  geometry: BufferGeometry;
  textures: DiceFaceTextureSet;
  onComplete?: () => void;
}) {
  const groupRefs = useRef<(Group | null)[]>([]);
  const elapsedSeconds = useRef(0);
  const completed = useRef(false);
  const scratch = useMemo(
    () => ({
      fromPosition: new Vector3(),
      toPosition: new Vector3(),
      fromRotation: new Quaternion(),
      toRotation: new Quaternion(),
    }),
    [],
  );
  const frames = roll.trajectory.frames;
  const finalStep = frames[frames.length - 1].step;
  const durationSeconds = finalStep * roll.trajectory.timeStep;

  useFrame((state, delta) => {
    if (completed.current) return;

    elapsedSeconds.current = Math.min(
      elapsedSeconds.current + Math.min(delta, 0.1),
      durationSeconds,
    );

    const exactStep = elapsedSeconds.current / roll.trajectory.timeStep;
    const fromIndex = Math.min(Math.floor(exactStep), frames.length - 1);
    const toIndex = Math.min(fromIndex + 1, frames.length - 1);
    const alpha = Math.min(1, Math.max(0, exactStep - fromIndex));
    const fromFrame = frames[fromIndex];
    const toFrame = frames[toIndex];

    for (let dieIndex = 0; dieIndex < roll.values.length; dieIndex += 1) {
      const group = groupRefs.current[dieIndex];
      if (!group) continue;

      const from = fromFrame.dice[dieIndex];
      const to = toFrame.dice[dieIndex];
      scratch.fromPosition.set(...from.position);
      scratch.toPosition.set(...to.position);
      group.position.lerpVectors(
        scratch.fromPosition,
        scratch.toPosition,
        alpha,
      );

      scratch.fromRotation.set(...from.rotation);
      scratch.toRotation.set(...to.rotation);
      group.quaternion.slerpQuaternions(
        scratch.fromRotation,
        scratch.toRotation,
        alpha,
      );
    }

    if (elapsedSeconds.current >= durationSeconds) {
      completed.current = true;
      onComplete?.();
      return;
    }

    state.invalidate();
  });

  const firstFrame = frames[0];

  return (
    <>
      {roll.visualRemaps.map((remap) => {
        const initial = firstFrame.dice[remap.index];
        return (
          <group
            key={`${roll.key}:${remap.index}`}
            ref={(group) => {
              groupRefs.current[remap.index] = group;
            }}
            position={initial.position}
            quaternion={initial.rotation}
          >
            <group quaternion={remap.rotation}>
              <DieVisual
                geometry={geometry}
                textures={textures}
                size={DICE_PHYSICS.dieSize}
                radius={DICE_PHYSICS.dieRadius}
              />
            </group>
          </group>
        );
      })}
    </>
  );
}
