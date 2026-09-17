"use client";

import type { BufferGeometry } from "three";
import { DICE_FACE_DEFINITIONS } from "@/src/lib/client/dice/geometry/dice-faces";
import type { DiceFaceTextureSet } from "@/src/lib/client/dice/types";

const DICE_BODY_GOLD = "#d0ad5a";
const DICE_EDGE_COLOR = "#111111";

// BoxGeometry cria os grupos de material em +X, -X, +Y, -Y, +Z e -Z.
// A geometria arredondada preserva esses grupos e os UVs, então a textura
// pode acompanhar a curvatura sem planos destacados sobre a superfície.
const DICE_BOX_MATERIAL_FACE_VALUES = [2, 5, 1, 6, 3, 4] as const;

export function DieVisual({
  geometry,
  textures,
  size = 1,
  radius = 0.1,
  bodyColor,
  surfaceWrappedFaces = false,
}: {
  geometry: BufferGeometry;
  textures: DiceFaceTextureSet;
  size?: number;
  radius?: number;
  bodyColor?: string | null;
  surfaceWrappedFaces?: boolean;
}) {
  const faceSize = Math.max(size * 0.55, size - radius * 1.65);
  const faceOffset = size / 2 + size * 0.0025;
  const resolvedBodyColor = bodyColor ?? DICE_BODY_GOLD;

  return (
    <>
      {surfaceWrappedFaces ? (
        <mesh geometry={geometry} castShadow receiveShadow>
          {DICE_BOX_MATERIAL_FACE_VALUES.map((value, index) => (
            <meshPhysicalMaterial
              key={value}
              attach={`material-${index}`}
              map={textures[value]}
              metalness={0.04}
              roughness={0.38}
              clearcoat={0.3}
              clearcoatRoughness={0.32}
            />
          ))}
        </mesh>
      ) : (
        <mesh geometry={geometry} castShadow receiveShadow>
          <meshPhysicalMaterial
            color={resolvedBodyColor}
            metalness={0.08}
            roughness={0.34}
            clearcoat={0.38}
            clearcoatRoughness={0.3}
          />
        </mesh>
      )}

      <lineSegments geometry={geometry} scale={1.006} renderOrder={3}>
        <edgesGeometry args={[geometry, 28]} />
        <lineBasicMaterial
          color={DICE_EDGE_COLOR}
          transparent
          opacity={surfaceWrappedFaces ? 0.48 : 0.82}
          depthWrite={false}
        />
      </lineSegments>

      {!surfaceWrappedFaces &&
        DICE_FACE_DEFINITIONS.map((face) => (
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
