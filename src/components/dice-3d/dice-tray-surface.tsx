"use client";

import { DICE_PHYSICS } from "@/src/lib/client/dice/physics/dice-physics-config";

export function DiceTraySurface() {
  return (
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
  );
}
