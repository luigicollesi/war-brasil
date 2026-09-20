"use client";

import { useMemo } from "react";
import { Quaternion, Vector3, type BufferGeometry } from "three";
import { diceFaceDefinition } from "@/src/lib/client/dice/geometry/dice-faces";
import type {
  DiceFaceTextureSet,
  DiceValue,
  DiceVector3,
} from "@/src/lib/client/dice/types";
import { DiceModel3D } from "./dice-model-3d";

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
  bodyColor,
  bodyHighlightColor,
}: {
  geometry: BufferGeometry;
  textures: DiceFaceTextureSet;
  topValue: DiceValue;
  position?: DiceVector3;
  size?: number;
  radius?: number;
  yaw?: number;
  bodyColor?: string | null;
  bodyHighlightColor?: string | null;
}) {
  const quaternion = useMemo(
    () => topValueQuaternion(topValue, yaw),
    [topValue, yaw],
  );

  return (
    <group position={position} quaternion={quaternion}>
      <DiceModel3D
        geometry={geometry}
        textures={textures}
        size={size}
        radius={radius}
        bodyColor={bodyColor}
        bodyHighlightColor={bodyHighlightColor}
      />
    </group>
  );
}
