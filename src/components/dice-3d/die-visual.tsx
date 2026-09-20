"use client";

import {
  DiceModel3D,
  type DiceModel3DProps,
} from "./dice-model-3d";

type DieVisualProps = DiceModel3DProps & {
  /**
   * Legacy compatibility only. The store-style wrapped surface is now the
   * single canonical renderer, so both values intentionally render the same.
   */
  surfaceWrappedFaces?: boolean;
};

export function DieVisual(props: DieVisualProps) {
  return <DiceModel3D {...props} />;
}
