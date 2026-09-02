"use client";

import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import type { BufferGeometry } from "three";
import { DICE_PHYSICS } from "@/src/lib/client/dice/physics/dice-physics-config";
import type {
  DiceFaceTextureSet,
  DiceLaunchState,
} from "@/src/lib/client/dice/types";
import { DieVisual } from "./die-visual";

export function PhysicsDie({
  launch,
  geometry,
  textures,
  bodyRef,
  onSleep,
  onWake,
}: {
  launch: DiceLaunchState;
  geometry: BufferGeometry;
  textures: DiceFaceTextureSet;
  bodyRef: (body: RapierRigidBody | null) => void;
  onSleep: () => void;
  onWake: () => void;
}) {
  return (
    <RigidBody
      ref={bodyRef}
      name={`dice-physics-${launch.index}`}
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
      onSleep={onSleep}
      onWake={onWake}
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
      <DieVisual
        geometry={geometry}
        textures={textures}
        size={DICE_PHYSICS.dieSize}
        radius={DICE_PHYSICS.dieRadius}
      />
    </RigidBody>
  );
}
