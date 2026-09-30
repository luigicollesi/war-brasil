import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const migration = read("src/lib/db/migrations/managed/082-battle-pass-season-1.sql");
const economyContract = read("src/lib/economy/economy-contract.ts");
const collectionRepository = read("src/lib/server/economy/economy-storefront-repository.ts");
const collectionService = read("src/lib/server/economy/economy-service.ts");
const store = read("src/components/profile/v4/profile-store.tsx");
const showcaseProjection = read("src/lib/economy/store-showcase.ts");
const showcase = read("src/components/profile/v4/store-showcase/store-showcase.tsx");
const appearanceContract = read("src/lib/economy/profile-appearance-store-contract.ts");
const appearanceRepository = read("src/lib/server/economy/profile-appearance-store-repository.ts");
const appearanceService = read("src/lib/server/economy/profile-appearance-store-service.ts");
const category = read("src/components/profile/v4/profile-store-category.tsx");

test("Season 1 retires direct reward offers and guards against reopening them", () => {
  assert.match(migration, /SET status='retired',[\s\S]*active=FALSE/);
  assert.match(migration, /reject_battle_pass_reward_direct_offer/);
  assert.match(migration, /battle_pass_reward_direct_offer_guard/);
  assert.match(migration, /reward\.reward_kind='game_cosmetic'/);
  assert.match(migration, /reward\.reward_kind='profile_background'/);
  assert.match(migration, /reward\.reward_kind='commander_title'/);
});

test("collections derive Battle Pass provenance from rewards instead of offers", () => {
  assert.match(economyContract, /StorefrontBattlePassRewardSource/);
  assert.match(economyContract, /battlePassReward: StorefrontBattlePassRewardSource \| null/);
  assert.match(collectionRepository, /battle_pass_collections AS/);
  assert.match(collectionRepository, /catalog\.battle_pass_rewards/);
  assert.match(collectionRepository, /reward\.reward_kind='game_cosmetic'/);
  assert.match(collectionService, /battlePassReward:/);
  assert.match(store, /RECOMPENSA DO PASSE/);
  assert.match(store, /PASSE \/\/ /);
});

test("reward-only collection showcase links to Campaign instead of purchase", () => {
  assert.match(showcaseProjection, /battlePassReward: StorefrontBattlePassRewardSource \| null/);
  assert.match(showcaseProjection, /battlePassReward: collection\.battlePassReward/);
  assert.match(showcase, /RECOMPENSA DO PASSE/);
  assert.match(showcase, /href="\/campaign"/);
  assert.match(showcase, /VER NO PASSE/);
});

test("Battle Pass backgrounds remain discoverable without catalog offers", () => {
  assert.match(appearanceContract, /ProfileAppearanceBattlePassReward/);
  assert.match(appearanceContract, /battlePassRewards: ReadonlyArray<ProfileAppearanceBattlePassReward>/);
  assert.match(appearanceRepository, /listBattlePassProfileBackgroundRows/);
  assert.match(appearanceRepository, /FROM catalog\.battle_pass_rewards reward/);
  assert.match(appearanceRepository, /JOIN catalog\.profile_backgrounds background/);
  assert.match(appearanceRepository, /reward\.reward_kind='profile_background'/);
  assert.match(appearanceService, /listBattlePassProfileBackgroundRows/);
  assert.match(appearanceService, /battlePassRewards/);
  assert.match(category, /battlePassBackgroundRewards/);
  assert.match(category, /RECOMPENSA DO PASSE/);
  assert.match(category, /VER NO PASSE/);
});

test("reward-only appearance projection does not expose completion titles in the store", () => {
  const rewardQuery = appearanceRepository.slice(
    appearanceRepository.indexOf("export async function listBattlePassProfileBackgroundRows"),
  );
  assert.doesNotMatch(rewardQuery, /catalog\.commander_titles/);
  assert.doesNotMatch(rewardQuery, /reward_kind='commander_title'/);
  assert.match(migration, /reject_battle_pass_exclusive_title_commerce/);
  assert.match(migration, /commander_titles_battle_pass_exclusive_no_collection_check/);
});
