"use client";

import { Color, type BufferGeometry } from "three";
import { resolveDiceBodyColors } from "@/src/lib/client/dice/body-color";
import type { DiceFaceTextureSet } from "@/src/lib/client/dice/types";
import {
  DICE_VISUAL_CORNER_HIGHLIGHT_END,
  DICE_VISUAL_CORNER_HIGHLIGHT_START,
  DICE_VISUAL_EDGE_DISSOLVE_END,
  DICE_VISUAL_EDGE_DISSOLVE_START,
} from "@/src/lib/client/dice/visual-config";

const DICE_EDGE_COLOR = "#111111";

// BoxGeometry and the rounded derivative keep the material groups ordered as:
// +X, -X, +Y, -Y, +Z, -Z.
const DICE_BOX_MATERIAL_FACE_VALUES = [2, 5, 1, 6, 3, 4] as const;

export type DiceModel3DProps = {
  geometry: BufferGeometry;
  textures: DiceFaceTextureSet;
  size?: number;
  /** Kept in the shared contract because geometry creation depends on it. */
  radius?: number;
  bodyColor?: string | null;
  bodyHighlightColor?: string | null;
};

export function DiceModel3D({
  geometry,
  textures,
  size = 1,
  bodyColor,
  bodyHighlightColor,
}: DiceModel3DProps) {
  const resolvedBody = resolveDiceBodyColors(bodyColor, bodyHighlightColor);
  const materialKey = [
    resolvedBody.bodyColor,
    resolvedBody.bodyHighlightColor,
    size,
  ].join(":");

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        {DICE_BOX_MATERIAL_FACE_VALUES.map((value, index) => (
          <meshPhysicalMaterial
            key={`${materialKey}:${value}`}
            attach={`material-${index}`}
            map={textures[value]}
            metalness={0.04}
            roughness={0.38}
            clearcoat={0.3}
            clearcoatRoughness={0.32}
            onBeforeCompile={(shader) => {
              shader.uniforms.diceBodyColor = {
                value: new Color(resolvedBody.bodyColor),
              };
              shader.uniforms.diceBodyHighlightColor = {
                value: new Color(resolvedBody.bodyHighlightColor),
              };
              shader.uniforms.diceBodyHalfSize = { value: size / 2 };

              shader.vertexShader = shader.vertexShader
                .replace(
                  "#include <common>",
                  `#include <common>\nvarying vec3 vDiceLocalPosition;`,
                )
                .replace(
                  "#include <begin_vertex>",
                  `#include <begin_vertex>\nvDiceLocalPosition = position;`,
                );

              shader.fragmentShader = shader.fragmentShader
                .replace(
                  "#include <common>",
                  `#include <common>\nvarying vec3 vDiceLocalPosition;\nuniform vec3 diceBodyColor;\nuniform vec3 diceBodyHighlightColor;\nuniform float diceBodyHalfSize;`,
                )
                .replace(
                  "#include <map_fragment>",
                  `#include <map_fragment>\nvec3 diceP = abs(vDiceLocalPosition) / max(diceBodyHalfSize, 0.0001);\nfloat diceMinAxis = min(diceP.x, min(diceP.y, diceP.z));\nfloat diceMaxAxis = max(diceP.x, max(diceP.y, diceP.z));\nfloat diceSecondAxis = diceP.x + diceP.y + diceP.z - diceMinAxis - diceMaxAxis;\nvec3 diceTextureColor = diffuseColor.rgb;\nfloat diceEdgeMask = smoothstep(${DICE_VISUAL_EDGE_DISSOLVE_START}, ${DICE_VISUAL_EDGE_DISSOLVE_END}, diceSecondAxis);\nfloat diceCornerFactor = smoothstep(${DICE_VISUAL_CORNER_HIGHLIGHT_START}, ${DICE_VISUAL_CORNER_HIGHLIGHT_END}, diceMinAxis);\nvec3 diceEdgeColor = mix(diceBodyColor, diceBodyHighlightColor, diceCornerFactor);\ndiffuseColor.rgb = mix(diceTextureColor, diceEdgeColor, diceEdgeMask);`,
                );
            }}
          />
        ))}
      </mesh>

      <lineSegments geometry={geometry} scale={1.006} renderOrder={3}>
        <edgesGeometry args={[geometry, 28]} />
        <lineBasicMaterial
          color={DICE_EDGE_COLOR}
          transparent
          opacity={0.48}
          depthWrite={false}
        />
      </lineSegments>
    </>
  );
}
