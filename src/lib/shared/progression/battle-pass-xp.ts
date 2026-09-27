import type {
  BattlePassLevelThreshold,
  BattlePassXpProfile,
} from "./battle-pass-contract";

function nonNegativeInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(\`Invalid battle-pass \${label}.\`);
  }
  return Number(value);
}

export function parseBattlePassXpProfile(value: unknown): BattlePassXpProfile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid battle-pass XP profile.");
  }

  const row = value as Record<string, unknown>;
  const completionXp = nonNegativeInteger(row.completionXp, "completion XP");
  const victoryBonusXp = nonNegativeInteger(
    row.victoryBonusXp,
    "victory bonus XP",
  );
  const soloHumanBotMultiplierBps = nonNegativeInteger(
    row.soloHumanBotMultiplierBps,
    "solo-human multiplier",
  );

  if (soloHumanBotMultiplierBps > 10_000) {
    throw new Error("Invalid battle-pass solo-human multiplier.");
  }
  if (completionXp + victoryBonusXp <= 0) {
    throw new Error("Battle-pass XP profile must grant positive XP.");
  }

  return {
    completionXp,
    victoryBonusXp,
    soloHumanBotMultiplierBps,
  };
}

export function calculateBattlePassMatchXp(input: Readonly<{
  profile: BattlePassXpProfile;
  completed: boolean;
  isWinner: boolean;
  humanParticipantCount: number;
}>) {
  if (!input.completed) {
    return {
      completionXp: 0,
      victoryBonusXp: 0,
      multiplierBps: 0,
      totalXp: 0,
    };
  }

  const completionXp = nonNegativeInteger(
    input.profile.completionXp,
    "completion XP",
  );
  const victoryBonusXp = input.isWinner
    ? nonNegativeInteger(input.profile.victoryBonusXp, "victory bonus XP")
    : 0;
  const humanParticipantCount = nonNegativeInteger(
    input.humanParticipantCount,
    "human participant count",
  );
  const multiplierBps =
    humanParticipantCount === 1
      ? nonNegativeInteger(
          input.profile.soloHumanBotMultiplierBps,
          "solo-human multiplier",
        )
      : 10_000;

  if (multiplierBps > 10_000) {
    throw new Error("Invalid battle-pass multiplier.");
  }

  return {
    completionXp,
    victoryBonusXp,
    multiplierBps,
    totalXp: Math.floor(
      ((completionXp + victoryBonusXp) * multiplierBps) / 10_000,
    ),
  };
}

export function resolveBattlePassLevel(
  thresholds: ReadonlyArray<BattlePassLevelThreshold>,
  totalXp: number,
) {
  const xp = nonNegativeInteger(totalXp, "total XP");
  let resolvedLevel = 1;
  let previousThreshold = -1;

  for (const threshold of thresholds) {
    const level = nonNegativeInteger(threshold.level, "level");
    const requiredTotalXp = nonNegativeInteger(
      threshold.requiredTotalXp,
      "level threshold",
    );
    if (level < 1 || level > 100 || requiredTotalXp <= previousThreshold) {
      throw new Error("Invalid battle-pass level thresholds.");
    }
    previousThreshold = requiredTotalXp;
    if (requiredTotalXp <= xp) resolvedLevel = level;
  }

  return Math.min(100, resolvedLevel);
}
