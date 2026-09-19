"use client";

import { useMemo } from "react";
import { DiceModel3D } from "@/src/components/dice-3d/dice-model-3d";
import { useDiceFaceTextures } from "@/src/components/dice-3d/use-dice-face-textures";
import { getSharedRoundedDieGeometry } from "@/src/lib/client/dice/dice-assets-manager";
import type { DiceSkin } from "@/src/lib/client/dice/types";
import {
  DICE_VISUAL_PIP_COLOR,
  DICE_VISUAL_TEXTURE_RESOLUTION,
  diceVisualGeometry,
} from "@/src/lib/client/dice/visual-config";
import type { CosmeticCatalogItem } from "@/src/lib/economy/economy-contract";
import { useDiceBodyColor } from "./use-dice-body-color";

const SHOWCASE_DIE_SIZE = 1;
const SHOWCASE_DIE_GEOMETRY = diceVisualGeometry(SHOWCASE_DIE_SIZE);

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
    () => getSharedRoundedDieGeometry(SHOWCASE_DIE_GEOMETRY),
    [],
  );
  const { textures } = useDiceFaceTextures({
    skin,
    assetRef,
    bodyColor,
    pipColor: DICE_VISUAL_PIP_COLOR,
    resolution: DICE_VISUAL_TEXTURE_RESOLUTION,
  });

  if (!textures || (assetRef && bodyColor === undefined)) return null;

  return (
    <group name="StoreShowcaseDie" position={[0, 0.08, 0]}>
      <DiceModel3D
        geometry={geometry}
        textures={textures}
        size={SHOWCASE_DIE_GEOMETRY.size}
        radius={SHOWCASE_DIE_GEOMETRY.radius}
        bodyColor={bodyColor}
      />
    </group>
  );
}
