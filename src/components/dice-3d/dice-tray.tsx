"use client";

import { CuboidCollider } from "@react-three/rapier";
import { DICE_PHYSICS } from "@/src/lib/client/dice/physics/dice-physics-config";
import { DiceTraySurface } from "./dice-tray-surface";

const floorCenterY =
  DICE_PHYSICS.floorTopY - DICE_PHYSICS.floorHalfThickness;
const wallCenterY =
  DICE_PHYSICS.floorTopY + DICE_PHYSICS.wallHalfHeight;

const colliderMaterial = {
  friction: DICE_PHYSICS.friction,
  restitution: DICE_PHYSICS.restitution,
};

export function DiceTray({ showSurface = true }: { showSurface?: boolean }) {
  return (
    <>
      <CuboidCollider
        name="dice-tray-floor"
        position={[0, floorCenterY, 0]}
        args={[
          DICE_PHYSICS.trayHalfWidth,
          DICE_PHYSICS.floorHalfThickness,
          DICE_PHYSICS.trayHalfDepth,
        ]}
        {...colliderMaterial}
      />
      <CuboidCollider
        name="dice-tray-left"
        position={[-DICE_PHYSICS.trayHalfWidth, wallCenterY, 0]}
        args={[
          DICE_PHYSICS.wallHalfThickness,
          DICE_PHYSICS.wallHalfHeight,
          DICE_PHYSICS.trayHalfDepth,
        ]}
        {...colliderMaterial}
      />
      <CuboidCollider
        name="dice-tray-right"
        position={[DICE_PHYSICS.trayHalfWidth, wallCenterY, 0]}
        args={[
          DICE_PHYSICS.wallHalfThickness,
          DICE_PHYSICS.wallHalfHeight,
          DICE_PHYSICS.trayHalfDepth,
        ]}
        {...colliderMaterial}
      />
      <CuboidCollider
        name="dice-tray-back"
        position={[0, wallCenterY, -DICE_PHYSICS.trayHalfDepth]}
        args={[
          DICE_PHYSICS.trayHalfWidth,
          DICE_PHYSICS.wallHalfHeight,
          DICE_PHYSICS.wallHalfThickness,
        ]}
        {...colliderMaterial}
      />
      <CuboidCollider
        name="dice-tray-front"
        position={[0, wallCenterY, DICE_PHYSICS.trayHalfDepth]}
        args={[
          DICE_PHYSICS.trayHalfWidth,
          DICE_PHYSICS.wallHalfHeight,
          DICE_PHYSICS.wallHalfThickness,
        ]}
        {...colliderMaterial}
      />
      {showSurface ? <DiceTraySurface /> : null}
    </>
  );
}
