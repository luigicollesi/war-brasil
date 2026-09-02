"use client";

import { useMemo } from "react";
import { Quaternion, Vector3, type BufferGeometry } from "three";
import { diceFaceDefinition } from "@/src/lib/client/dice/geometry/dice-faces";
import type {
  DiceFaceTextureSet,
  DiceValue,
  DiceVector3,
} from "@/src/lib/client/dice/types";
import { DieVisual } from "./die-visual";

const WORLD_UP = new Vector3(0, 1, 0);

function topValueQuaternion(value: DiceValue, yaw: number) {
  const face = diceFaceDefinition(value);
  const sourceNormal = new Vector3(...face.normal);
  const align = new Quaternion().setFromUnitVectors(sourceNormal, WORLD_UP);
  const yawRotation = new Quaternion().setFromAxisAngle(WORLD_UP, yaw);
  return yawRotation.multiply(align);
}

export function Die3D({
  geometry,
  textures,
  topValue,
  position = [0, 0, 0],
  size = 1,
  radius = 0.1,
  yaw = 0.34,
}: {
  geometry: BufferGeometry;
  textures: DiceFaceTextureSet;
  topValue: DiceValue;
  position?: DiceVector3;
  size?: number;
  radius?: number;
  yaw?: number;
}) {
  const quaternion = useMemo(
    () => topValueQuaternion(topValue, yaw),
    [topValue, yaw],
  );

  return (
    <group position={position} quaternion={quaternion}>
      <DieVisual
        geometry={geometry}
        textures={textures}
        size={size}
        radius={radius}
      />
    </group>
  );
}
