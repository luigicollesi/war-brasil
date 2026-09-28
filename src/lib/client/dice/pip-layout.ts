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

const DICE_PIP_COMPACT_LAYOUT_PERCENT: Readonly<
  Record<DiceValue, readonly (readonly [number, number])[]>
> = {
  1: [[50, 50]],
  2: [[36, 36], [64, 64]],
  3: [[36, 36], [50, 50], [64, 64]],
  4: [[36, 36], [64, 36], [36, 64], [64, 64]],
  5: [[36, 36], [64, 36], [50, 50], [36, 64], [64, 64]],
  6: [[36, 32], [64, 32], [36, 50], [64, 50], [36, 68], [64, 68]],
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
