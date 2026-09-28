import type { DiceValue } from "./types";

export const DICE_VALUES = [1, 2, 3, 4, 5, 6] as const satisfies readonly DiceValue[];

export type DicePipSpacing = "spread" | "compact";

export const DICE_PIP_LAYOUT_PERCENT: Readonly<
  Record<DiceValue, readonly (readonly [number, number])[]>
> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
};

// Compact cosmetics keep the horizontal center at 50%. Their artwork needs
// only a slight upward optical correction, while preserving the tighter
// spacing between pips.
const DICE_PIP_COMPACT_LAYOUT_PERCENT: Readonly<
  Record<DiceValue, readonly (readonly [number, number])[]>
> = {
  1: [[50, 48]],
  2: [[36, 34], [64, 62]],
  3: [[36, 34], [50, 48], [64, 62]],
  4: [[36, 34], [64, 34], [36, 62], [64, 62]],
  5: [[36, 34], [64, 34], [50, 48], [36, 62], [64, 62]],
  6: [[36, 30], [64, 30], [36, 48], [64, 48], [36, 66], [64, 66]],
};

export function dicePipLayout(
  value: DiceValue,
  spacing: DicePipSpacing = "spread",
) {
  return spacing === "compact"
    ? DICE_PIP_COMPACT_LAYOUT_PERCENT[value]
    : DICE_PIP_LAYOUT_PERCENT[value];
}

export function isDiceValue(value: number): value is DiceValue {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

export function normalizeDiceValue(value: number): DiceValue {
  return isDiceValue(value) ? value : 1;
}
