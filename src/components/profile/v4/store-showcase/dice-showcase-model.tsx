"use client";

import { useMemo } from "react";
import { DieVisual } from "@/src/components/dice-3d/die-visual";
import { useDiceFaceTextures } from "@/src/components/dice-3d/use-dice-face-textures";
import { getSharedRoundedDieGeometry } from "@/src/lib/client/dice/dice-assets-manager";
import type { DiceSkin } from "@/src/lib/client/dice/types";
import type { CosmeticCatalogItem } from "@/src/lib/economy/economy-contract";

type DiceShowcaseSlot = Extract<
  CosmeticCatalogItem["slot"],
  "dice_attack" | "dice_defense" | "dice_neutral"
>;

function skinForSlot(slot: DiceShowcaseSlot): DiceSkin {
  switch (slot) {
    case "dice_attack":
      return "attack";
    case "dice_defense":
      return "defense";
    case "dice_neutral":
      return "neutral";
  }
}

export function DiceShowcaseModel({
  slot,
  assetRef,
}: {
  slot: DiceShowcaseSlot;
  assetRef: string | null;
}) {
  const skin = skinForSlot(slot);
  const geometry = useMemo(
    () => getSharedRoundedDieGeometry({ size: 1.9, radius: 0.19, segments: 10 }),
    [],
  );
  const { textures } = useDiceFaceTextures({
    skin,
    assetRef,
    pipColor: "#0b0b0b",
    resolution: 512,
  });

  if (!textures) return null;

  return (
    <group name="StoreShowcaseDie" position={[0, 0.08, 0]} scale={1.08}>
      <DieVisual geometry={geometry} textures={textures} size={1.9} radius={0.19} />
    </group>
  );
}
