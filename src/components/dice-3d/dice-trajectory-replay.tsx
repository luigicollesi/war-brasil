"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Group,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from "three";
import { createCameraFacingDockQuaternion } from "@/src/lib/client/dice/animation/camera-facing-dock";
import {
  analyzeDiceTrajectoryTiming,
  mapDiceReplayProgress,
} from "@/src/lib/client/dice/animation/trajectory-time-map";
import type {
  DiceFaceTextureSet,
  DiceQuaternion,
  DiceTrajectoryFrame,
  DiceVector3,
  PredeterminedDiceRoll,
} from "@/src/lib/client/dice/types";
import { DICE_PHYSICS } from "@/src/lib/client/dice/physics/dice-physics-config";
import { DieVisual } from "./die-visual";

function smoothStep(value: number) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function sampleTrajectoryState(
  frames: readonly DiceTrajectoryFrame[],
  finalStep: number,
  progress: number,
  dieIndex: number,
): { position: DiceVector3; rotation: DiceQuaternion } {
  const exactStep = clamp01(progress) * finalStep;
  const fromIndex = Math.min(Math.floor(exactStep), frames.length - 1);
  const toIndex = Math.min(fromIndex + 1, frames.length - 1);
  const alpha = clamp01(exactStep - fromIndex);
  const from = frames[fromIndex].dice[dieIndex];
  const to = frames[toIndex].dice[dieIndex];

  const position: DiceVector3 = [
    from.position[0] + (to.position[0] - from.position[0]) * alpha,
    from.position[1] + (to.position[1] - from.position[1]) * alpha,
    from.position[2] + (to.position[2] - from.position[2]) * alpha,
  ];

  if (alpha <= 0 || fromIndex === toIndex) {
    return { position, rotation: [...from.rotation] };
  }

  const quaternion = new Quaternion(...from.rotation).slerp(
    new Quaternion(...to.rotation),
    alpha,
  );
  const rotation: DiceQuaternion = [
    quaternion.x,
    quaternion.y,
    quaternion.z,
    quaternion.w,
  ];

  return { position, rotation };
}

export function DiceTrajectoryReplay({
  roll,
  geometry,
  textures,
  playbackDurationMs,
  initialElapsedMs = 0,
  visualScale = 1,
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
  initialElapsedMs?: number;
  visualScale?: number;
  dockPositions?: readonly DiceVector3[];
  dockScale?: number;
  dockDurationMs?: number;
  skipAnimation?: boolean;
  onComplete?: () => void;
}) {
  const camera = useThree((state) => state.camera);
  const frames = roll.trajectory.frames;
  const finalFrame = frames[frames.length - 1];
  const finalStep = finalFrame.step;
  const trajectoryTiming = useMemo(
    () => analyzeDiceTrajectoryTiming(frames),
    [frames],
  );
  const physicalDurationSeconds = finalStep * roll.trajectory.timeStep;
  const replayDurationSeconds = Math.max(
    0.001,
    playbackDurationMs === undefined
      ? physicalDurationSeconds
      : playbackDurationMs / 1000,
  );
  const initialReplaySeconds = Math.min(
    replayDurationSeconds,
    Math.max(0, initialElapsedMs / 1000),
  );
  const dockDurationSeconds = Math.max(0, dockDurationMs / 1000);
  const canDock =
    dockPositions !== undefined && dockPositions.length === roll.values.length;
  const cameraPosition: DiceVector3 = [
    camera.position.x,
    camera.position.y,
    camera.position.z,
  ];
  const dockRotations = canDock
    ? roll.visualRemaps.map((remap) =>
        createCameraFacingDockQuaternion(
          finalFrame.dice[remap.index].rotation,
          remap.physicalTopValue,
          dockPositions![remap.index],
          cameraPosition,
        ),
      )
    : [];
  const groupRefs = useRef<(Group | null)[]>([]);
  const elapsedSeconds = useRef(initialReplaySeconds);
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

      const replayProgress = elapsedSeconds.current / replayDurationSeconds;
      const trajectoryProgress = mapDiceReplayProgress(
        replayProgress,
        trajectoryTiming,
      );
      const exactStep = trajectoryProgress * finalStep;
      const fromIndex = Math.min(Math.floor(exactStep), frames.length - 1);
      const toIndex = Math.min(fromIndex + 1, frames.length - 1);
      const alpha = clamp01(exactStep - fromIndex);
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

    if (
      canDock &&
      dockDurationSeconds > 0 &&
      dockElapsedSeconds.current < dockDurationSeconds
    ) {
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
        scratch.fromRotation.set(...finalFrame.dice[dieIndex].rotation);
        scratch.toRotation.set(...dockRotations[dieIndex]);
        group.quaternion.slerpQuaternions(
          scratch.fromRotation,
          scratch.toRotation,
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
        group.quaternion.set(...dockRotations[dieIndex]);
        group.scale.setScalar(dockScale);
      }
    }

    completed.current = true;
    onComplete?.();
    state.invalidate();
  });

  const initialReplayProgress = skipInitially
    ? 1
    : initialReplaySeconds / replayDurationSeconds;
  const initialTrajectoryProgress = mapDiceReplayProgress(
    initialReplayProgress,
    trajectoryTiming,
  );

  return (
    <>
      {roll.visualRemaps.map((remap) => {
        const sampled = sampleTrajectoryState(
          frames,
          finalStep,
          initialTrajectoryProgress,
          remap.index,
        );
        const initialPosition =
          skipInitially && canDock ? dockPositions![remap.index] : sampled.position;
        const initialQuaternion =
          skipInitially && canDock ? dockRotations[remap.index] : sampled.rotation;
        const initialScale = skipInitially && canDock ? dockScale : 1;

        return (
          <group
            key={`${roll.key}:${remap.index}`}
            ref={(group) => {
              groupRefs.current[remap.index] = group;
            }}
            position={initialPosition}
            quaternion={initialQuaternion}
            scale={initialScale}
          >
            <group quaternion={remap.rotation} scale={visualScale}>
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
