import assert from "node:assert/strict";
import test from "node:test";

const contract = await import(
  "../.test-build/shared/progression/battle-pass-contract.js"
);
const xp = await import(
  "../.test-build/shared/progression/battle-pass-xp.js"
);
const rewardState = await import(
  "../.test-build/shared/progression/battle-pass-reward-state.js"
);

test("matriz monetária V1 preserva preço, totais, mínimo e nível 100 sem moedas", () => {
  assert.equal(contract.BATTLE_PASS_PREMIUM_PRICE, 3000);
  assert.equal(
    contract.BATTLE_PASS_V1_FREE_CREDIT_REWARDS.reduce(
      (sum, reward) => sum + reward.amount,
      0,
    ),
    1000,
  );
  assert.equal(
    contract.BATTLE_PASS_V1_PREMIUM_CREDIT_REWARDS.reduce(
      (sum, reward) => sum + reward.amount,
      0,
    ),
    2500,
  );

  for (const reward of [
    ...contract.BATTLE_PASS_V1_FREE_CREDIT_REWARDS,
    ...contract.BATTLE_PASS_V1_PREMIUM_CREDIT_REWARDS,
  ]) {
    assert.ok(reward.amount >= 5);
    assert.notEqual(reward.level, 100);
  }
});

test("V1 preserva os 19 níveis totalmente vazios definidos no SPEC", () => {
  assert.deepEqual(contract.BATTLE_PASS_V1_EMPTY_LEVELS, [
    6, 9, 16, 19, 26, 29, 36, 39, 46, 49,
    56, 59, 66, 69, 76, 79, 86, 89, 96,
  ]);
});

test("XP por match aplica bônus de vitória e multiplicador de partida solo com bots", () => {
  const profile = {
    completionXp: 100,
    victoryBonusXp: 50,
    soloHumanBotMultiplierBps: 4000,
  };

  assert.deepEqual(
    xp.calculateBattlePassMatchXp({
      profile,
      completed: true,
      isWinner: true,
      humanParticipantCount: 2,
    }),
    {
      completionXp: 100,
      victoryBonusXp: 50,
      multiplierBps: 10000,
      totalXp: 150,
    },
  );

  assert.equal(
    xp.calculateBattlePassMatchXp({
      profile,
      completed: true,
      isWinner: true,
      humanParticipantCount: 1,
    }).totalXp,
    60,
  );

  assert.equal(
    xp.calculateBattlePassMatchXp({
      profile,
      completed: false,
      isWinner: true,
      humanParticipantCount: 2,
    }).totalXp,
    0,
  );
});

test("nível é resolvido por thresholds cumulativos e limitado ao nível 100", () => {
  const thresholds = Array.from({ length: 100 }, (_, index) => ({
    level: index + 1,
    requiredTotalXp: index * 100,
  }));

  assert.equal(xp.resolveBattlePassLevel(thresholds, 0), 1);
  assert.equal(xp.resolveBattlePassLevel(thresholds, 99), 1);
  assert.equal(xp.resolveBattlePassLevel(thresholds, 100), 2);
  assert.equal(xp.resolveBattlePassLevel(thresholds, 9_900), 100);
  assert.equal(xp.resolveBattlePassLevel(thresholds, 999_999), 100);
});

test("estado de reward diferencia nível, Elite e claim persistido", () => {
  assert.equal(
    rewardState.deriveBattlePassRewardState({
      rewardLevel: 20,
      levelReached: 19,
      track: "free",
      premiumAccess: false,
      claimed: false,
    }),
    "locked",
  );
  assert.equal(
    rewardState.deriveBattlePassRewardState({
      rewardLevel: 20,
      levelReached: 20,
      track: "premium",
      premiumAccess: false,
      claimed: false,
    }),
    "premium_locked",
  );
  assert.equal(
    rewardState.deriveBattlePassRewardState({
      rewardLevel: 20,
      levelReached: 20,
      track: "premium",
      premiumAccess: true,
      claimed: false,
    }),
    "claimable",
  );
  assert.equal(
    rewardState.deriveBattlePassRewardState({
      rewardLevel: 20,
      levelReached: 20,
      track: "premium",
      premiumAccess: true,
      claimed: true,
    }),
    "claimed",
  );
});
