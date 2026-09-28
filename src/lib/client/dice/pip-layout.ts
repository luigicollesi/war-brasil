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

// Compact cosmetics use artwork whose usable face is slightly right/up from
// the raw texture midpoint. Keep the compact cluster symmetric around this
// optical center while preserving the tighter spacing between pips.
const DICE_PIP_COMPACT_LAYOUT_PERCENT: Readonly<
  Record<DiceValue, readonly (readonly [number, number])[]>
> = {
  1: [[55, 48]],
  2: [[41, 34], [69, 62]],
  3: [[41, 34], [55, 48], [69, 62]],
  4: [[41, 34], [69, 34], [41, 62], [69, 62]],
  5: [[41, 34], [69, 34], [55, 48], [41, 62], [69, 62]],
  6: [[41, 30], [69, 30], [41, 48], [69, 48], [41, 66], [69, 66]],
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
