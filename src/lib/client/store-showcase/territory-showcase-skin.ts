import { territoryMaterial } from "@/src/lib/client/map/territory-material";
import {
  isTerritorySkinAssetKey,
  territorySkinAssetDeliveryPath,
  territorySkinRuntimeEffectKey,
  territorySkinSnapshot,
} from "@/src/lib/economy/territory-skin-contract";

export const SHOWCASE_TERRITORY_PREVIEW_COLOR = "forest" as const;
// Mirrors the normal-state luminosity overlay used by the canonical game board.
export const SHOWCASE_TERRITORY_SKIN_OPACITY = 0.52;

export type TerritoryShowcaseSkinInput = Readonly<{
  cosmeticId: string;
  assetRef: string | null;
  effectKey: string | null;
}>;

export type TerritoryShowcaseSkin = Readonly<{
  kind: "procedural" | "image";
  frontColor: string;
  sideColor: string;
  rimColor: string;
  skinAssetRef: string | null;
  skinOpacity: number;
}>;

function deliveredTerritorySkinAsset(assetRef: string | null) {
  const normalized = assetRef?.trim();
  if (!normalized) return null;

  // WebGL texture uploads are subject to canvas/WebGL CORS rules. Keep the
  // texture fetch same-origin even when the server projected a public CDN URL.
  // The authenticated asset route proxies the same canonical object key.
  if (normalized.startsWith("/api/assets/territory-skins?key=")) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    const objectKey = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (url.protocol !== "https:" || !isTerritorySkinAssetKey(objectKey)) {
      return null;
    }
    return territorySkinAssetDeliveryPath(objectKey);
  } catch {
    return null;
  }
}

export function resolveTerritoryShowcaseSkin(
  input: TerritoryShowcaseSkinInput,
): TerritoryShowcaseSkin {
  const deliveredAssetRef = deliveredTerritorySkinAsset(input.assetRef);

  if (deliveredAssetRef && !input.effectKey?.trim()) {
    const material = territoryMaterial(SHOWCASE_TERRITORY_PREVIEW_COLOR);
    return {
      kind: "image",
      frontColor: material.face[2],
      sideColor: material.side[1],
      rimColor: material.rim,
      skinAssetRef: deliveredAssetRef,
      skinOpacity: SHOWCASE_TERRITORY_SKIN_OPACITY,
    };
  }

  const snapshot = territorySkinSnapshot(input);
  const runtimeEffectKey = territorySkinRuntimeEffectKey(snapshot);
  const material = territoryMaterial(
    SHOWCASE_TERRITORY_PREVIEW_COLOR,
    runtimeEffectKey,
  );

  return {
    kind: snapshot.kind,
    frontColor: material.face[2],
    sideColor: material.side[1],
    rimColor: material.rim,
    skinAssetRef: material.skinAssetRef,
    skinOpacity: SHOWCASE_TERRITORY_SKIN_OPACITY,
  };
}
