export const BATTLE_PASS_MAX_LEVEL = 100 as const;
export const BATTLE_PASS_PREMIUM_PRICE = 3_000 as const;
export const BATTLE_PASS_FREE_CREDIT_TOTAL = 1_000 as const;
export const BATTLE_PASS_PREMIUM_CREDIT_TOTAL = 2_500 as const;
export const BATTLE_PASS_MIN_CREDIT_REWARD = 5 as const;

export type BattlePassTrack = "free" | "premium";

export type BattlePassRewardKind =
  | "campaign_credit"
  | "game_cosmetic"
  | "commander_title"
  | "profile_background";

export type BattlePassRewardState =
  | "locked"
  | "premium_locked"
  | "claimable"
  | "claiming"
  | "claimed";

export type BattlePassXpProfile = Readonly<{
  completionXp: number;
  victoryBonusXp: number;
  soloHumanBotMultiplierBps: number;
}>;

export type BattlePassLevelThreshold = Readonly<{
  level: number;
  requiredTotalXp: number;
}>;

export type BattlePassCreditReward = Readonly<{
  level: number;
  amount: number;
}>;

function creditReward(level: number, amount: number): BattlePassCreditReward {
  return { level, amount };
}

function buildFreeCreditRewards() {
  const rewards: BattlePassCreditReward[] = [];
  for (let block = 0; block < 9; block += 1) {
    const base = block * 10;
    rewards.push(
      creditReward(base + 2, 5),
      creditReward(base + 4, 15),
      creditReward(base + 7, 30),
      creditReward(base + 10, 50),
    );
  }
  rewards.push(
    creditReward(92, 5),
    creditReward(94, 15),
    creditReward(97, 30),
    creditReward(99, 50),
  );
  return Object.freeze(rewards);
}

function buildPremiumCreditRewards() {
  const rewards: BattlePassCreditReward[] = [];
  for (let block = 0; block < 9; block += 1) {
    const base = block * 10;
    rewards.push(
      creditReward(base + 1, 5),
      creditReward(base + 3, 20),
      creditReward(base + 5, 50),
      creditReward(base + 8, 75),
      creditReward(base + 10, 100),
    );
  }
  rewards.push(
    creditReward(91, 5),
    creditReward(93, 20),
    creditReward(95, 50),
    creditReward(98, 75),
    creditReward(99, 100),
  );
  return Object.freeze(rewards);
}

export const BATTLE_PASS_V1_FREE_CREDIT_REWARDS = buildFreeCreditRewards();
export const BATTLE_PASS_V1_PREMIUM_CREDIT_REWARDS =
  buildPremiumCreditRewards();

export type BattlePassV1SeasonalRewardSpec = Readonly<{
  level: number;
  kind: "game_cosmetic" | "commander_title" | "profile_background";
  slot:
    | "dice_attack"
    | "dice_defense"
    | "dice_neutral"
    | "territory_skin"
    | null;
  presentationGroupKey: string | null;
}>;

export const BATTLE_PASS_V1_FREE_COSMETIC_REWARDS = Object.freeze([
  { level: 15, kind: "game_cosmetic", slot: "dice_attack", presentationGroupKey: null },
  { level: 35, kind: "game_cosmetic", slot: "dice_defense", presentationGroupKey: null },
  { level: 55, kind: "game_cosmetic", slot: "dice_neutral", presentationGroupKey: null },
  { level: 75, kind: "game_cosmetic", slot: "territory_skin", presentationGroupKey: null },
  { level: 90, kind: "profile_background", slot: null, presentationGroupKey: null },
  { level: 100, kind: "commander_title", slot: null, presentationGroupKey: null },
] satisfies ReadonlyArray<BattlePassV1SeasonalRewardSpec>);

export const BATTLE_PASS_V1_PREMIUM_INITIAL_COSMETIC_REWARDS = Object.freeze([
  { level: 1, kind: "game_cosmetic", slot: "dice_attack", presentationGroupKey: "premium-initial-set" },
  { level: 1, kind: "game_cosmetic", slot: "dice_defense", presentationGroupKey: "premium-initial-set" },
  { level: 1, kind: "game_cosmetic", slot: "dice_neutral", presentationGroupKey: "premium-initial-set" },
  { level: 1, kind: "game_cosmetic", slot: "territory_skin", presentationGroupKey: "premium-initial-set" },
] satisfies ReadonlyArray<BattlePassV1SeasonalRewardSpec>);

export const BATTLE_PASS_V1_PREMIUM_FINAL_COSMETIC_REWARDS = Object.freeze([
  { level: 60, kind: "game_cosmetic", slot: "dice_attack", presentationGroupKey: null },
  { level: 70, kind: "game_cosmetic", slot: "dice_defense", presentationGroupKey: null },
  { level: 80, kind: "game_cosmetic", slot: "dice_neutral", presentationGroupKey: null },
  { level: 90, kind: "game_cosmetic", slot: "territory_skin", presentationGroupKey: null },
  { level: 95, kind: "profile_background", slot: null, presentationGroupKey: null },
  { level: 100, kind: "commander_title", slot: null, presentationGroupKey: null },
] satisfies ReadonlyArray<BattlePassV1SeasonalRewardSpec>);

export const BATTLE_PASS_V1_FREE_COSMETIC_LEVELS = Object.freeze([
  15, 35, 55, 75, 90, 100,
] as const);

export const BATTLE_PASS_V1_PREMIUM_FINAL_COSMETIC_LEVELS = Object.freeze([
  60, 70, 80, 90, 95, 100,
] as const);

export const BATTLE_PASS_V1_EMPTY_LEVELS = Object.freeze([
  6, 9, 16, 19, 26, 29, 36, 39, 46, 49,
  56, 59, 66, 69, 76, 79, 86, 89, 96,
] as const);
