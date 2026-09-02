"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Group,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from "three";
import type {
  DiceFaceTextureSet,
  DiceVector3,
  PredeterminedDiceRoll,
} from "@/src/lib/client/dice/types";
import { DICE_PHYSICS } from "@/src/lib/client/dice/physics/dice-physics-config";
import { DieVisual } from "./die-visual";

function smoothStep(value: number) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

export function DiceTrajectoryReplay({
  roll,
  geometry,
  textures,
  playbackDurationMs,
  dockPositions,
  dockScale = 1,
  dockDurationMs = 0,
  skipAnimation = false,
  onComplete,
}: {
  roll: PredeterminedDiceRoll;
  geometry: BufferGeometry;
  textures: DiceFaceTextureSet;
  playbackDurationMs?: number;
  dockPositions?: readonly DiceVector3[];
  dockScale?: number;
  dockDurationMs?: number;
  skipAnimation?: boolean;
  onComplete?: () => void;
}) {
  const groupRefs = useRef<(Group | null)[]>([]);
  const elapsedSeconds = useRef(0);
  const dockElapsedSeconds = useRef(0);
  const completed = useRef(false);
  const [skipInitially] = useState(skipAnimation);
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
  const firstFrame = frames[0];
  const finalFrame = frames[frames.length - 1];
  const finalStep = finalFrame.step;
  const physicalDurationSeconds = finalStep * roll.trajectory.timeStep;
  const replayDurationSeconds = Math.max(
    0.001,
    playbackDurationMs === undefined
      ? physicalDurationSeconds
      : playbackDurationMs / 1000,
  );
  const dockDurationSeconds = Math.max(0, dockDurationMs / 1000);
  const canDock =
    dockPositions !== undefined && dockPositions.length === roll.values.length;

  useEffect(() => {
    if (!skipInitially || completed.current) return;
    completed.current = true;
    onComplete?.();
  }, [onComplete, skipInitially]);

  useFrame((state, delta) => {
    if (completed.current || skipInitially) return;

    if (elapsedSeconds.current < replayDurationSeconds) {
      elapsedSeconds.current = Math.min(
        elapsedSeconds.current + Math.min(delta, 0.1),
        replayDurationSeconds,
      );

      const progress = elapsedSeconds.current / replayDurationSeconds;
      const exactStep = progress * finalStep;
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

      state.invalidate();
      return;
    }

    if (canDock && dockDurationSeconds > 0 && dockElapsedSeconds.current < dockDurationSeconds) {
      dockElapsedSeconds.current = Math.min(
        dockElapsedSeconds.current + Math.min(delta, 0.1),
        dockDurationSeconds,
      );
      const progress = smoothStep(dockElapsedSeconds.current / dockDurationSeconds);

      for (let dieIndex = 0; dieIndex < roll.values.length; dieIndex += 1) {
        const group = groupRefs.current[dieIndex];
        if (!group) continue;

        scratch.fromPosition.set(...finalFrame.dice[dieIndex].position);
        scratch.toPosition.set(...dockPositions![dieIndex]);
        group.position.lerpVectors(
          scratch.fromPosition,
          scratch.toPosition,
          progress,
        );
        const scale = 1 + (dockScale - 1) * progress;
        group.scale.setScalar(scale);
      }

      state.invalidate();
      return;
    }

    if (canDock) {
      for (let dieIndex = 0; dieIndex < roll.values.length; dieIndex += 1) {
        const group = groupRefs.current[dieIndex];
        if (!group) continue;
        group.position.set(...dockPositions![dieIndex]);
        group.scale.setScalar(dockScale);
      }
    }

    completed.current = true;
    onComplete?.();
    state.invalidate();
  });

  return (
    <>
      {roll.visualRemaps.map((remap) => {
        const initialFrame = skipInitially ? finalFrame : firstFrame;
        const initial = initialFrame.dice[remap.index];
        const initialPosition =
          skipInitially && canDock ? dockPositions![remap.index] : initial.position;
        const initialScale = skipInitially && canDock ? dockScale : 1;

        return (
          <group
            key={`${roll.key}:${remap.index}`}
            ref={(group) => {
              groupRefs.current[remap.index] = group;
            }}
            position={initialPosition}
            quaternion={initial.rotation}
            scale={initialScale}
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
