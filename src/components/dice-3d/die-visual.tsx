"use client";

import type { BufferGeometry } from "three";
import { DICE_FACE_DEFINITIONS } from "@/src/lib/client/dice/geometry/dice-faces";
import type { DiceFaceTextureSet } from "@/src/lib/client/dice/types";

const DICE_BODY_GOLD = "#d0ad5a";
const DICE_EDGE_COLOR = "#111111";

export function DieVisual({
  geometry,
  textures,
  size = 1,
  radius = 0.1,
}: {
  geometry: BufferGeometry;
  textures: DiceFaceTextureSet;
  size?: number;
  radius?: number;
}) {
  const faceSize = Math.max(size * 0.55, size - radius * 1.65);
  const faceOffset = size / 2 + size * 0.0025;

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={DICE_BODY_GOLD}
          metalness={0.08}
          roughness={0.34}
          clearcoat={0.38}
          clearcoatRoughness={0.3}
        />
      </mesh>

      <lineSegments geometry={geometry} scale={1.006} renderOrder={3}>
        <edgesGeometry args={[geometry, 28]} />
        <lineBasicMaterial
          color={DICE_EDGE_COLOR}
          transparent
          opacity={0.82}
          depthWrite={false}
        />
      </lineSegments>

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
            roughness={0.46}
            metalness={0.01}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      ))}
    </>
  );
}
