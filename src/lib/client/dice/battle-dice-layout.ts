import { validateDicePhysicsCount } from "./physics/create-dice-launch-plan";
import type { DiceVector3 } from "./types";

export type BattleDiceDockSide = "attack" | "defense";

export const BATTLE_DICE_REPLAY_MS = 1_200;
export const BATTLE_DICE_DOCK_MS = 360;

export function battleDiceLaunchOffset(side: BattleDiceDockSide): DiceVector3 {
  return side === "attack" ? [-0.9, 0, 0.12] : [0.9, 0, -0.12];
}

export function battleDiceDockScale(count: number) {
  validateDicePhysicsCount(count);
  if (count === 1) return 1.28;
  if (count === 2) return 1.02;
  return 0.84;
}

export function battleDiceDockPositions(
  side: BattleDiceDockSide,
  count: number,
): DiceVector3[] {
  validateDicePhysicsCount(count);

  const sign = side === "attack" ? -1 : 1;
  const xMagnitudes =
    count === 1 ? [1.85] : count === 2 ? [2.1, 1.28] : [2.35, 1.65, 0.95];

  return xMagnitudes.map(
    (magnitude): DiceVector3 => [sign * magnitude, 0.08, 0.15],
  );
}
