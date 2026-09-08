import type { DiceBalanceProfile } from "@/src/lib/shared/dice-balance";

export const DICE_WEIGHT_TOTAL = 6_000_000;
export const BUILTIN_SAFE_UNIFORM_PROFILE_ID = "builtin-uniform-v1";

export const SAFE_UNIFORM_DICE_PROFILE: DiceBalanceProfile = Object.freeze({
  algorithm: "uniform",
  alpha: 0,
  pressureCap: 0,
  deadZone: 0,
  retentionPerRound: 1,
  maxGroupShift: 0,
  innerTilt: 0,
  minFaceProbability: 1 / 6,
  maxFaceProbability: 1 / 6,
});
