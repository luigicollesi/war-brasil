"use client";

import {
  Physics,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Suspense, useMemo, useRef } from "react";
import type { BufferGeometry } from "three";
import { getSharedRoundedDieGeometry } from "@/src/lib/client/dice/dice-assets-manager";
import { createDiceLaunchPlan } from "@/src/lib/client/dice/physics/create-dice-launch-plan";
import { detectPhysicalTopFace } from "@/src/lib/client/dice/physics/detect-top-face";
import { DICE_PHYSICS } from "@/src/lib/client/dice/physics/dice-physics-config";
import type {
  DiceFaceTextureSet,
  DicePhysicsSettledHandler,
  DiceQuaternion,
  DiceSettledBodyState,
} from "@/src/lib/client/dice/types";
import { DiceTray } from "./dice-tray";
import { PhysicsDie } from "./physics-die";

function PhysicsDiceGroup({
  geometry,
  textures,
  count,
  seed,
  onSettled,
}: {
  geometry: BufferGeometry;
  textures: DiceFaceTextureSet;
  count: number;
  seed: string;
  onSettled?: DicePhysicsSettledHandler;
}) {
  const launchPlan = useMemo(
    () => createDiceLaunchPlan(count, seed),
    [count, seed],
  );
  const bodyRefs = useRef<(RapierRigidBody | null)[]>([]);
  const sleepingBodies = useRef(new Set<number>());
  const settledReported = useRef(false);

  const handleWake = (index: number) => {
    sleepingBodies.current.delete(index);
    settledReported.current = false;
  };

  const handleSleep = (index: number) => {
    sleepingBodies.current.add(index);

    if (
      settledReported.current ||
      sleepingBodies.current.size !== launchPlan.dice.length
    ) {
      return;
    }

    const settledStates: DiceSettledBodyState[] = [];
    for (let dieIndex = 0; dieIndex < launchPlan.dice.length; dieIndex += 1) {
      const body = bodyRefs.current[dieIndex];
      if (!body) return;

      const translation = body.translation();
      const rotation = body.rotation();
      const rotationTuple: DiceQuaternion = [
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w,
      ];

      settledStates.push({
        index: dieIndex,
        position: [translation.x, translation.y, translation.z],
        rotation: rotationTuple,
        physicalTopValue: detectPhysicalTopFace(rotationTuple),
      });
    }

    settledReported.current = true;
    onSettled?.(settledStates);
  };

  return (
    <>
      {launchPlan.dice.map((launch) => (
        <PhysicsDie
          key={launch.id}
          launch={launch}
          geometry={geometry}
          textures={textures}
          bodyRef={(body) => {
            bodyRefs.current[launch.index] = body;
          }}
          onSleep={() => handleSleep(launch.index)}
          onWake={() => handleWake(launch.index)}
        />
      ))}
    </>
  );
}

export function DicePhysicsStage({
  count,
  seed,
  textures,
  onSettled,
}: {
  count: number;
  seed: string;
  textures: DiceFaceTextureSet;
  onSettled?: DicePhysicsSettledHandler;
}) {
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
    <Suspense fallback={null}>
      <Physics
        gravity={DICE_PHYSICS.gravity}
        colliders={false}
        timeStep={DICE_PHYSICS.timeStep}
        updateLoop="independent"
      >
        <DiceTray />
        <PhysicsDiceGroup
          key={`${count}:${seed}`}
          geometry={geometry}
          textures={textures}
          count={count}
          seed={seed}
          onSettled={onSettled}
        />
      </Physics>
    </Suspense>
  );
}
