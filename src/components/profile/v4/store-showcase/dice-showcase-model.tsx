"use client";

import { useMemo } from "react";
import { DieVisual } from "@/src/components/dice-3d/die-visual";
import { useDiceFaceTextures } from "@/src/components/dice-3d/use-dice-face-textures";
import { getSharedRoundedDieGeometry } from "@/src/lib/client/dice/dice-assets-manager";
import type { DiceSkin } from "@/src/lib/client/dice/types";
import type { CosmeticCatalogItem } from "@/src/lib/economy/economy-contract";
import { useDiceBodyColor } from "./use-dice-body-color";

function skinForSlot(slot: CosmeticCatalogItem["slot"]): DiceSkin {
  switch (slot) {
    case "dice_attack":
      return "attack";
    case "dice_defense":
      return "defense";
    case "dice_neutral":
      return "neutral";
    case "territory_skin":
      throw new Error("Territory skin cannot be rendered as a showcase die.");
  }
}

export function DiceShowcaseModel({
  slot,
  assetRef,
}: {
  slot: CosmeticCatalogItem["slot"];
  assetRef: string | null;
}) {
  const skin = skinForSlot(slot);
  const bodyColor = useDiceBodyColor(assetRef, slot);
  const geometry = useMemo(
    () => getSharedRoundedDieGeometry({ size: 1.9, radius: 0.19, segments: 10 }),
    [],
  );
  const { textures } = useDiceFaceTextures({
    skin,
    assetRef,
    bodyColor,
    pipColor: "#0b0b0b",
    resolution: 512,
  });

  if (!textures || (assetRef && bodyColor === undefined)) return null;

  return (
    <group name="StoreShowcaseDie" position={[0, 0.08, 0]} scale={1.08}>
      <DieVisual geometry={geometry} textures={textures} size={1.9} radius={0.19} />
    </group>
  );
}
