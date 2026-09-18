export const DICE_VISUAL_RADIUS_RATIO = 0.15;
export const DICE_VISUAL_SEGMENTS = 12;

export type DiceVisualGeometry = Readonly<{
  size: number;
  radius: number;
  segments: number;
}>;

export function diceVisualGeometry(size: number): DiceVisualGeometry {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("O tamanho visual do dado precisa ser positivo.");
  }

  return {
    size,
    radius: size * DICE_VISUAL_RADIUS_RATIO,
    segments: DICE_VISUAL_SEGMENTS,
  };
}
