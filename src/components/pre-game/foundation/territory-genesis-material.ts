import {
  Color,
  type ColorRepresentation,
  MeshStandardMaterial,
} from "three";
import { deterministicOpeningSeed } from "./opening-timeline";

export type TerritoryGenesisMaterialHandle = Readonly<{
  material: MeshStandardMaterial;
  progress: { value: number };
}>;

export function createTerritoryGenesisMaterial(
  color: ColorRepresentation,
  territoryId: number,
): TerritoryGenesisMaterialHandle {
  const progress = { value: 0 };
  const seed = { value: deterministicOpeningSeed(territoryId) };
  const material = new MeshStandardMaterial({
    color: new Color(color),
    roughness: 0.52,
    metalness: 0.08,
    emissive: new Color(color).multiplyScalar(0.035),
    emissiveIntensity: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -1.5,
    polygonOffsetUnits: -1.5,
    depthWrite: false,
  });

  material.customProgramCacheKey = () => "war-home-territory-genesis-v1";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGenesisProgress = progress;
    shader.uniforms.uGenesisSeed = seed;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vGenesisPosition;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\nvGenesisPosition = position;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uGenesisProgress;
uniform float uGenesisSeed;
varying vec3 vGenesisPosition;

float genesisHash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}
`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>

vec2 genesisCell = floor(vGenesisPosition.xy / 42.0);
float genesisNoise = genesisHash(
  genesisCell + vec2(uGenesisSeed * 31.0, uGenesisSeed * 17.0)
);
vec2 genesisNormalized = (vGenesisPosition.xy - vec2(627.0)) / 627.0;
float genesisRadial = length(genesisNormalized) * 0.48;
float genesisDirectional = dot(
  genesisNormalized,
  normalize(vec2(0.72, -0.38))
) * 0.14;
float genesisField =
  genesisRadial +
  genesisDirectional +
  genesisNoise * 0.42 +
  uGenesisSeed * 0.08;
float genesisThreshold = mix(-0.35, 1.45, uGenesisProgress);
float genesisFeather = fwidth(genesisField) * 1.8 + 0.015;
float genesisMask = smoothstep(
  genesisThreshold - genesisFeather,
  genesisThreshold + genesisFeather,
  genesisField
);

if (genesisMask < 0.5) discard;
`,
      );
  };

  return { material, progress };
}
