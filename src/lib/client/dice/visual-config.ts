export const DICE_VISUAL_RADIUS_RATIO = 0.15;
export const DICE_VISUAL_SEGMENTS = 12;
export const DICE_VISUAL_PIP_COLOR = "#0b0b0b";
export const DICE_VISUAL_TEXTURE_RESOLUTION = 512;

/**
 * UV sample scale for each face texture.
 * Lower values zoom the artwork in, making it cover more of the rounded face.
 * 1 = original framing.
 */
export const DICE_VISUAL_TEXTURE_UV_SCALE = 0.94;

/**
 * Rounded-edge highlight thresholds, normalized against half the die size.
 * Raise START values to confine the body/highlight transition closer to the edge.
 */
export const DICE_VISUAL_BEVEL_HIGHLIGHT_START = 0.8;
export const DICE_VISUAL_BEVEL_HIGHLIGHT_END = 0.95;
export const DICE_VISUAL_CORNER_HIGHLIGHT_START = 0.76;
export const DICE_VISUAL_CORNER_HIGHLIGHT_END = 0.94;

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
