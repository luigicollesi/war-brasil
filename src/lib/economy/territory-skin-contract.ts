export const TERRITORY_SKIN_SLOT = "territory_effect" as const;
export const DEFAULT_TERRITORY_SKIN_EFFECT_KEY = "default" as const;
export const DEFAULT_TERRITORY_SKIN_COSMETIC_ID = "territory.effect.default" as const;

export type TerritorySkinDescriptor = Readonly<{
  cosmeticId: string;
  assetRef: string | null;
  effectKey: string | null;
}>;

export type TerritorySkinSnapshot =
  | Readonly<{
      kind: "procedural";
      cosmeticId: string;
      effectKey: string;
    }>
  | Readonly<{
      kind: "image";
      cosmeticId: string;
      assetRef: string;
    }>;

export type TerritorySkinRender =
  | Extract<TerritorySkinSnapshot, { kind: "procedural" }>
  | Readonly<{
      kind: "image";
      cosmeticId: string;
      assetRef: string;
      imageUrl: string;
    }>;

export const DEFAULT_TERRITORY_SKIN: TerritorySkinSnapshot = Object.freeze({
  kind: "procedural",
  cosmeticId: DEFAULT_TERRITORY_SKIN_COSMETIC_ID,
  effectKey: DEFAULT_TERRITORY_SKIN_EFFECT_KEY,
});

const TERRITORY_SKIN_ASSET_KEY_PATTERN =
  /^cosmetics\/territory-skins\/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$/;

export function isTerritorySkinAssetKey(value: string): boolean {
  return TERRITORY_SKIN_ASSET_KEY_PATTERN.test(value);
}

export function assertTerritorySkinAssetKey(value: string): string {
  if (!isTerritorySkinAssetKey(value)) {
    throw new TypeError(
      "A referência de territory skin deve ser uma object key WebP em cosmetics/territory-skins/.",
    );
  }
  return value;
}

function normalizedText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function territorySkinSnapshot(
  descriptor: TerritorySkinDescriptor | null | undefined,
): TerritorySkinSnapshot {
  if (!descriptor) return DEFAULT_TERRITORY_SKIN;

  const cosmeticId = normalizedText(descriptor.cosmeticId);
  const assetRef = normalizedText(descriptor.assetRef);
  const effectKey = normalizedText(descriptor.effectKey);
  if (!cosmeticId) return DEFAULT_TERRITORY_SKIN;

  if (effectKey && !assetRef) {
    return {
      kind: "procedural",
      cosmeticId,
      effectKey,
    };
  }

  if (!effectKey && assetRef && isTerritorySkinAssetKey(assetRef)) {
    return {
      kind: "image",
      cosmeticId,
      assetRef,
    };
  }

  return DEFAULT_TERRITORY_SKIN;
}

export function territorySkinRender(
  snapshot: TerritorySkinSnapshot,
  imageUrlForAsset: (assetRef: string) => string,
): TerritorySkinRender {
  if (snapshot.kind === "procedural") return snapshot;
  return {
    ...snapshot,
    imageUrl: imageUrlForAsset(snapshot.assetRef),
  };
}
