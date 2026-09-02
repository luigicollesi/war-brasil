import type { DiceEuler, DiceValue, DiceVector3 } from "../types";

export type DiceFaceDefinition = {
  value: DiceValue;
  normal: DiceVector3;
  rotation: DiceEuler;
  opposite: DiceValue;
};

export const DICE_FACE_DEFINITIONS: readonly DiceFaceDefinition[] = [
  { value: 1, normal: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0], opposite: 6 },
  { value: 6, normal: [0, -1, 0], rotation: [Math.PI / 2, 0, 0], opposite: 1 },
  { value: 2, normal: [1, 0, 0], rotation: [0, Math.PI / 2, 0], opposite: 5 },
  { value: 5, normal: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0], opposite: 2 },
  { value: 3, normal: [0, 0, 1], rotation: [0, 0, 0], opposite: 4 },
  { value: 4, normal: [0, 0, -1], rotation: [0, Math.PI, 0], opposite: 3 },
];

export function diceFaceDefinition(value: DiceValue) {
  const definition = DICE_FACE_DEFINITIONS.find((face) => face.value === value);
  if (!definition) {
    throw new Error(`Face de dado inválida: ${value}`);
  }
  return definition;
}
