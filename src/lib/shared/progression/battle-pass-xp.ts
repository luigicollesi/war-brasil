import type {
  BattlePassLevelThreshold,
  BattlePassXpProfile,
} from "./battle-pass-contract";

function nonNegativeInteger(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid battle-pass ${label}.`);
  }
  return value;
}

function actionValue(
  row: Record<string, unknown>,
  key: string,
  label: string,
  legacy = 0,
) {
  if (row.actionModelVersion === undefined) return legacy;
  return nonNegativeInteger(row[key], label);
}

export function parseBattlePassXpProfile(value: unknown): BattlePassXpProfile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid battle-pass XP profile.");
  }

  const row = value as Record<string, unknown>;
  const actionModelVersion =
    row.actionModelVersion === undefined
      ? 1
      : nonNegativeInteger(row.actionModelVersion, "action model version");
  if (actionModelVersion < 1) {
    throw new Error("Invalid battle-pass action model version.");
  }

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
    actionModelVersion,
    troopPlacedXp: actionValue(row, "troopPlacedXp", "troop placed XP"),
    troopPlacedCapXp: actionValue(
      row,
      "troopPlacedCapXp",
      "troop placed XP cap",
    ),
    cardTradeXp: actionValue(row, "cardTradeXp", "card trade XP"),
    cardTradeCapXp: actionValue(row, "cardTradeCapXp", "card trade XP cap"),
    troopLostDiceXp: actionValue(row, "troopLostDiceXp", "troop lost dice XP"),
    troopLostDiceCapXp: actionValue(
      row,
      "troopLostDiceCapXp",
      "troop lost dice XP cap",
    ),
    enemyTroopDefeatedXp: actionValue(
      row,
      "enemyTroopDefeatedXp",
      "enemy troop defeated XP",
    ),
    enemyTroopDefeatedCapXp: actionValue(
      row,
      "enemyTroopDefeatedCapXp",
      "enemy troop defeated XP cap",
    ),
    territoryFirstConquestXp: actionValue(
      row,
      "territoryFirstConquestXp",
      "first conquest XP",
    ),
    territorySecondConquestXp: actionValue(
      row,
      "territorySecondConquestXp",
      "second conquest XP",
    ),
    playerEliminationXp:
      row.playerEliminationXp === undefined
        ? 0
        : nonNegativeInteger(
            row.playerEliminationXp,
            "player elimination XP",
          ),
    completionXp,
    victoryBonusXp,
    soloHumanBotMultiplierBps,
  };
}

export function scaleBattlePassXp(rawXp: number, multiplierBps: number) {
  const raw = nonNegativeInteger(rawXp, "raw XP");
  const multiplier = nonNegativeInteger(multiplierBps, "multiplier");
  if (multiplier > 10_000) {
    throw new Error("Invalid battle-pass multiplier.");
  }
  return Math.floor((raw * multiplier) / 10_000);
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

  return {
    completionXp,
    victoryBonusXp,
    multiplierBps,
    totalXp: scaleBattlePassXp(
      completionXp + victoryBonusXp,
      multiplierBps,
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
