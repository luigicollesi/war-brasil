export const DICE_VISUAL_RADIUS_RATIO = 0.15;
export const DICE_VISUAL_SEGMENTS = 12;
export const DICE_VISUAL_PIP_COLOR = "#0b0b0b";
export const DICE_VISUAL_TEXTURE_RESOLUTION = 512;

/**
 * UV sample scale for each face texture.
 * Lower values zoom the artwork in, making it cover more of the rounded face.
 * 1 = original framing.
 */
export const DICE_VISUAL_TEXTURE_UV_SCALE = 1;

/**
 * Edge dissolve thresholds, normalized against half the die size.
 * Outside this narrow band the WebP color is preserved exactly.
 * Raise START to make the colored edge thinner.
 */
export const DICE_VISUAL_EDGE_DISSOLVE_START = 0.84;
export const DICE_VISUAL_EDGE_DISSOLVE_END = 0.96;

/**
 * Controls only the color progression inside the already-masked edge/corner.
 */
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
