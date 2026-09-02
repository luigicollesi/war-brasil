"use client";

import { type ReactNode } from "react";
import type { DiceFaceTextureSet, DiceValue } from "@/src/lib/client/dice/types";
import { DiceTraySurface } from "./dice-tray-surface";
import { PredeterminedDiceRoll } from "./predetermined-dice-roll";

export function PredeterminedDiceStage({
  values,
  seed,
  textures,
  fallback,
}: {
  values: readonly DiceValue[];
  seed: string;
  textures: DiceFaceTextureSet;
  fallback: ReactNode;
}) {
  return (
    <>
      <ambientLight intensity={1.35} />
      <directionalLight
        position={[3.5, 5.5, 4.5]}
        intensity={3.2}
        castShadow
      />
      <directionalLight position={[-4, 2.5, 2]} intensity={1.1} />
      <PredeterminedDiceRoll
        values={values}
        seed={seed}
        textures={textures}
        preparingFallback={null}
        failureFallback={fallback}
      />
      <DiceTraySurface />
    </>
  );
}
