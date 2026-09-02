import { isDiceValue } from "./pip-layout";
import type { DiceValue } from "./types";

export function validateDiceValues(values: readonly number[]): DiceValue[] {
  if (values.length < 1 || values.length > 3) {
    throw new Error("A cena de dados aceita entre 1 e 3 dados.");
  }

  return values.map((value) => {
    if (!isDiceValue(value)) {
      throw new Error(`Valor de dado inválido: ${value}`);
    }
    return value;
  });
}
