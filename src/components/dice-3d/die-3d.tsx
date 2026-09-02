"use client";

import { useMemo } from "react";
import { Quaternion, Vector3, type BufferGeometry } from "three";
import {
  DICE_FACE_DEFINITIONS,
  diceFaceDefinition,
} from "@/src/lib/client/dice/geometry/dice-faces";
import type {
  DiceFaceTextureSet,
  DiceValue,
  DiceVector3,
} from "@/src/lib/client/dice/types";

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
  const faceSize = Math.max(size * 0.55, size - radius * 1.65);
  const faceOffset = size / 2 + size * 0.0025;

  return (
    <group position={position} quaternion={quaternion}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color="#e8e3d8"
          metalness={0.02}
          roughness={0.42}
        />
      </mesh>

      {DICE_FACE_DEFINITIONS.map((face) => (
        <mesh
          key={face.value}
          position={[
            face.normal[0] * faceOffset,
            face.normal[1] * faceOffset,
            face.normal[2] * faceOffset,
          ]}
          rotation={face.rotation}
          renderOrder={2}
        >
          <planeGeometry args={[faceSize, faceSize]} />
          <meshStandardMaterial
            map={textures[face.value]}
            transparent
            alphaTest={0.01}
            roughness={0.48}
            metalness={0.01}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      ))}
    </group>
  );
}
