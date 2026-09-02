import type { BufferGeometry } from "three";
import { createRoundedDieGeometry } from "./geometry/create-rounded-die-geometry";
import { DICE_VALUES } from "./pip-layout";
import type {
  DiceFaceTextureSet,
  DiceTextureOptions,
  RoundedDieGeometryOptions,
} from "./types";
import { createDiceFaceTexture } from "./textures/create-face-texture";
import {
  DEFAULT_DICE_PIP_COLOR,
  DEFAULT_DICE_TEXTURE_RESOLUTION,
} from "./textures/dice-skins";

const geometryCache = new Map<string, BufferGeometry>();
const textureCache = new Map<string, Promise<DiceFaceTextureSet>>();

function geometryKey(options: RoundedDieGeometryOptions) {
  return [options.size ?? 1, options.radius ?? 0.1, options.segments ?? 8].join(":");
}

function textureKey(options: DiceTextureOptions) {
  return [
    options.skin,
    options.pipColor ?? DEFAULT_DICE_PIP_COLOR,
    options.resolution ?? DEFAULT_DICE_TEXTURE_RESOLUTION,
  ].join(":");
}

export function getSharedRoundedDieGeometry(
  options: RoundedDieGeometryOptions = {},
) {
  const key = geometryKey(options);
  const cached = geometryCache.get(key);
  if (cached) return cached;

  const geometry = createRoundedDieGeometry(options);
  geometry.name = `war-brasil-rounded-die:${key}`;
  geometryCache.set(key, geometry);
  return geometry;
}

export function getDiceFaceTextures(options: DiceTextureOptions) {
  const key = textureKey(options);
  const cached = textureCache.get(key);
  if (cached) return cached;

  const promise = Promise.all(
    DICE_VALUES.map(async (value) => [
      value,
      await createDiceFaceTexture({ ...options, value }),
    ] as const),
  ).then(
    (entries) => Object.fromEntries(entries) as unknown as DiceFaceTextureSet,
  );

  textureCache.set(key, promise);
  promise.catch(() => textureCache.delete(key));
  return promise;
}

export async function preloadDiceAssets({
  geometry,
  texture,
}: {
  geometry?: RoundedDieGeometryOptions;
  texture: DiceTextureOptions;
}) {
  getSharedRoundedDieGeometry(geometry);
  await getDiceFaceTextures(texture);
}

export async function disposeDiceAssetCaches() {
  for (const geometry of geometryCache.values()) {
    geometry.dispose();
  }
  geometryCache.clear();

  const settledTextureSets = await Promise.allSettled(textureCache.values());
  for (const result of settledTextureSets) {
    if (result.status !== "fulfilled") continue;
    for (const texture of Object.values(result.value)) {
      texture.dispose();
    }
  }
  textureCache.clear();
}
