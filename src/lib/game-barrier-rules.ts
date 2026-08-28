export type AttackMode = "normal" | "barrier";

export const BARRIER_ATTACK_DICE_BANDS = [
  { minimumTroops: 4, maximumTroops: 6, diceCount: 1 },
  { minimumTroops: 7, maximumTroops: 9, diceCount: 2 },
  { minimumTroops: 10, maximumTroops: null, diceCount: 3 },
] as const;

export type AttackProfile =
  | {
      kind: "unavailable";
      mode: AttackMode;
      minimumTroops: number;
    }
  | {
      kind: "available";
      mode: AttackMode;
      minimumTroops: number;
      diceCount: 1 | 2 | 3;
      attackerLossPerComparison: 1 | 3;
    };

export type ManeuverTraversalProfile =
  | {
      kind: "normal";
      barrierCount: 0;
      troopLoss: 0;
      minimumTroops: 1;
    }
  | {
      kind: "barrier";
      barrierCount: 1;
      troopLoss: 1;
      minimumTroops: 2;
    }
  | {
      kind: "blocked";
      barrierCount: number;
      minimumBarrierCount: 2;
    };

function minimumAttackTroops(mode: AttackMode) {
  return mode === "barrier" ? 4 : 2;
}

function barrierAttackDiceCount(troops: number): 1 | 2 | 3 {
  for (const band of BARRIER_ATTACK_DICE_BANDS) {
    if (
      troops >= band.minimumTroops &&
      (band.maximumTroops === null || troops <= band.maximumTroops)
    ) {
      return band.diceCount;
    }
  }

  return 1;
}

export function attackerLossPerComparison(mode: AttackMode): 1 | 3 {
  return mode === "barrier" ? 3 : 1;
}

export function attackProfile(troops: number, mode: AttackMode): AttackProfile {
  const minimumTroops = minimumAttackTroops(mode);

  if (!Number.isInteger(troops) || troops < minimumTroops) {
    return { kind: "unavailable", mode, minimumTroops };
  }

  if (mode === "barrier") {
    return {
      kind: "available",
      mode,
      minimumTroops,
      diceCount: barrierAttackDiceCount(troops),
      attackerLossPerComparison: attackerLossPerComparison(mode),
    };
  }

  const diceCount = Math.min(3, troops - 1) as 1 | 2 | 3;
  return {
    kind: "available",
    mode,
    minimumTroops,
    diceCount,
    attackerLossPerComparison: attackerLossPerComparison(mode),
  };
}

export function maneuverTraversalProfile(
  barrierCount: number,
): ManeuverTraversalProfile {
  if (!Number.isInteger(barrierCount) || barrierCount < 0) {
    throw new RangeError("barrierCount precisa ser um inteiro não negativo.");
  }

  if (barrierCount === 0) {
    return {
      kind: "normal",
      barrierCount: 0,
      troopLoss: 0,
      minimumTroops: 1,
    };
  }

  if (barrierCount === 1) {
    return {
      kind: "barrier",
      barrierCount: 1,
      troopLoss: 1,
      minimumTroops: 2,
    };
  }

  return {
    kind: "blocked",
    barrierCount,
    minimumBarrierCount: 2,
  };
}
