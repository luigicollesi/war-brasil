import type { DiceValue } from "./types";

export const DICE_VALUES = [1, 2, 3, 4, 5, 6] as const satisfies readonly DiceValue[];

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

export function isDiceValue(value: number): value is DiceValue {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

export function normalizeDiceValue(value: number): DiceValue {
  return isDiceValue(value) ? value : 1;
}
