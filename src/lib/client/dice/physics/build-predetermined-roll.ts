import { validateDiceValues } from "../dice-values";
import type {
  DicePhysicsTrajectory,
  DiceSettledBodyState,
  PredeterminedDiceRoll,
} from "../types";
import { createVisualFaceRemap } from "./visual-face-remap";

function settledStatesByIndex(
  trajectory: DicePhysicsTrajectory,
  expectedCount: number,
) {
  if (trajectory.frames.length < 2) {
    throw new Error("A trajetória dos dados precisa conter movimento físico.");
  }
  if (trajectory.timeStep <= 0 || !Number.isFinite(trajectory.timeStep)) {
    throw new Error("A trajetória dos dados possui timestep inválido.");
  }
  if (trajectory.settled.length !== expectedCount) {
    throw new Error("A trajetória não corresponde à quantidade de dados esperada.");
  }

  const settled = new Map<number, DiceSettledBodyState>();
  for (const state of trajectory.settled) {
    if (
      !Number.isInteger(state.index) ||
      state.index < 0 ||
      state.index >= expectedCount ||
      settled.has(state.index)
    ) {
      throw new Error("A trajetória possui índices de dados inválidos.");
    }
    settled.set(state.index, state);
  }

  return settled;
}

export function buildPredeterminedDiceRoll(
  values: readonly number[],
  trajectory: DicePhysicsTrajectory,
): PredeterminedDiceRoll {
  const safeValues = validateDiceValues(values);
  const settled = settledStatesByIndex(trajectory, safeValues.length);

  const visualRemaps = safeValues.map((targetValue, index) => {
    const physicalState = settled.get(index);
    if (!physicalState) {
      throw new Error(`Estado físico ausente para o dado ${index}.`);
    }

    return {
      index,
      targetValue,
      physicalTopValue: physicalState.physicalTopValue,
      rotation: createVisualFaceRemap(
        targetValue,
        physicalState.physicalTopValue,
      ),
    };
  });

  return {
    key: `${trajectory.seed}:${safeValues.join("-")}`,
    seed: trajectory.seed,
    values: safeValues,
    trajectory,
    visualRemaps,
  };
}
