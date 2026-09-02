"use client";

import {
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
  useRapier,
} from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import { createDiceLaunchPlan } from "@/src/lib/client/dice/physics/create-dice-launch-plan";
import { detectPhysicalTopFace } from "@/src/lib/client/dice/physics/detect-top-face";
import { DICE_PHYSICS } from "@/src/lib/client/dice/physics/dice-physics-config";
import type {
  DicePhysicsTrajectory,
  DiceQuaternion,
  DiceTrajectoryBodyState,
  DiceTrajectoryFrame,
  DiceVector3,
} from "@/src/lib/client/dice/types";
import { DiceTray } from "./dice-tray";

function PreSimulationDie({
  launch,
  bodyRef,
}: {
  launch: ReturnType<typeof createDiceLaunchPlan>["dice"][number];
  bodyRef: (body: RapierRigidBody | null) => void;
}) {
  return (
    <RigidBody
      ref={bodyRef}
      name={`dice-pre-simulation-${launch.index}`}
      colliders={false}
      position={launch.position}
      quaternion={launch.rotation}
      linearVelocity={launch.linearVelocity}
      angularVelocity={launch.angularVelocity}
      linearDamping={DICE_PHYSICS.linearDamping}
      angularDamping={DICE_PHYSICS.angularDamping}
      additionalSolverIterations={DICE_PHYSICS.additionalSolverIterations}
      canSleep
      ccd
    >
      <CuboidCollider
        args={[
          DICE_PHYSICS.colliderHalfExtent,
          DICE_PHYSICS.colliderHalfExtent,
          DICE_PHYSICS.colliderHalfExtent,
        ]}
        friction={DICE_PHYSICS.friction}
        restitution={DICE_PHYSICS.restitution}
        contactSkin={DICE_PHYSICS.contactSkin}
      />
    </RigidBody>
  );
}

function captureFrame(
  step: number,
  bodies: readonly RapierRigidBody[],
): DiceTrajectoryFrame {
  const dice: DiceTrajectoryBodyState[] = bodies.map((body, index) => {
    const position = body.translation();
    const rotation = body.rotation();
    return {
      index,
      position: [position.x, position.y, position.z],
      rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
    };
  });

  return { step, dice };
}

function PreSimulationController({
  seed,
  count,
  bodyRefs,
  onComplete,
  onError,
}: {
  seed: string;
  count: number;
  bodyRefs: { current: (RapierRigidBody | null)[] };
  onComplete: (trajectory: DicePhysicsTrajectory) => void;
  onError: (error: Error) => void;
}) {
  const { step } = useRapier();
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;

    const bodies = bodyRefs.current.slice(0, count);
    if (bodies.length !== count || bodies.some((body) => body === null)) {
      reported.current = true;
      onError(new Error("Os corpos físicos dos dados não foram inicializados."));
      return;
    }

    const resolvedBodies = bodies as RapierRigidBody[];
    const frames: DiceTrajectoryFrame[] = [captureFrame(0, resolvedBodies)];
    let settled = false;

    for (
      let stepIndex = 1;
      stepIndex <= DICE_PHYSICS.maxSimulationSteps;
      stepIndex += 1
    ) {
      step(DICE_PHYSICS.timeStep);
      frames.push(captureFrame(stepIndex, resolvedBodies));

      if (resolvedBodies.every((body) => body.isSleeping())) {
        settled = true;
        break;
      }
    }

    if (!settled) {
      reported.current = true;
      onError(
        new Error(
          `A pré-simulação dos dados excedeu ${DICE_PHYSICS.maxSimulationSteps} passos.`,
        ),
      );
      return;
    }

    const finalFrame = frames[frames.length - 1];
    const settledStates = finalFrame.dice.map((state) => {
      const rotation: DiceQuaternion = [...state.rotation];
      return {
        index: state.index,
        position: [...state.position] as [number, number, number],
        rotation,
        physicalTopValue: detectPhysicalTopFace(rotation),
      };
    });

    reported.current = true;
    onComplete({
      seed,
      timeStep: DICE_PHYSICS.timeStep,
      frames,
      settled: settledStates,
    });
  }, [bodyRefs, count, onComplete, onError, seed, step]);

  return null;
}

export function DicePreSimulation({
  count,
  seed,
  launchOffset = [0, 0, 0],
  onComplete,
  onError,
}: {
  count: number;
  seed: string;
  launchOffset?: DiceVector3;
  onComplete: (trajectory: DicePhysicsTrajectory) => void;
  onError: (error: Error) => void;
}) {
  const launchPlan = useMemo(
    () => createDiceLaunchPlan(count, seed, launchOffset),
    [count, launchOffset, seed],
  );
  const bodyRefs = useRef<(RapierRigidBody | null)[]>([]);

  return (
    <Physics
      gravity={DICE_PHYSICS.gravity}
      colliders={false}
      timeStep={DICE_PHYSICS.timeStep}
      interpolate={false}
      paused
    >
      <DiceTray showSurface={false} />
      {launchPlan.dice.map((launch) => (
        <PreSimulationDie
          key={launch.id}
          launch={launch}
          bodyRef={(body) => {
            bodyRefs.current[launch.index] = body;
          }}
        />
      ))}
      <PreSimulationController
        seed={seed}
        count={count}
        bodyRefs={bodyRefs}
        onComplete={onComplete}
        onError={onError}
      />
    </Physics>
  );
}
