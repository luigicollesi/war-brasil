"use client";

import { CuboidCollider } from "@react-three/rapier";
import { DICE_PHYSICS } from "@/src/lib/client/dice/physics/dice-physics-config";

const floorCenterY =
  DICE_PHYSICS.floorTopY - DICE_PHYSICS.floorHalfThickness;
const wallCenterY =
  DICE_PHYSICS.floorTopY + DICE_PHYSICS.wallHalfHeight;

const colliderMaterial = {
  friction: DICE_PHYSICS.friction,
  restitution: DICE_PHYSICS.restitution,
};

export function DiceTray() {
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

      <mesh
        position={[0, DICE_PHYSICS.floorTopY + 0.001, 0]}
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
