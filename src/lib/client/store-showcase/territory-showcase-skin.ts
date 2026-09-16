import { territoryMaterial } from "@/src/lib/client/map/territory-material";
import {
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

export function resolveTerritoryShowcaseSkin(
  input: TerritoryShowcaseSkinInput,
): TerritoryShowcaseSkin {
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
