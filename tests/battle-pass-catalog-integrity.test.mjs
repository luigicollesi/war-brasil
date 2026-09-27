import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hardening = readFileSync(
  "src/lib/db/migrations/managed/072-battle-pass-catalog-hardening.sql",
  "utf8",
);
const immutability = readFileSync(
  "src/lib/db/migrations/managed/073-battle-pass-catalog-immutability.sql",
  "utf8",
);
const rewardIdentity = readFileSync(
  "src/lib/db/migrations/managed/076-battle-pass-reward-identity.sql",
  "utf8",
);
const xpV1Integrity = readFileSync(
  "src/lib/db/migrations/managed/078-battle-pass-xp-v1-integrity.sql",
  "utf8",
);

test("XP profiles são append-only e catálogo ativo/histórico é congelado", () => {
  assert.match(immutability, /battle_pass_xp_profiles_append_only/);
  assert.match(
    immutability,
    /BEFORE UPDATE OR DELETE ON catalog\.battle_pass_xp_profiles/,
  );
  assert.match(immutability, /battle_pass_seasons_mutation_guard/);
  assert.match(immutability, /battle_pass_levels_mutation_guard/);
  assert.match(immutability, /battle_pass_rewards_mutation_guard/);
  assert.match(immutability, /battle_pass_pricing_mutation_guard/);
  assert.match(
    immutability,
    /active or historical battle pass child catalog is immutable/,
  );
  assert.doesNotMatch(
    immutability,
    /CREATE OR REPLACE FUNCTION catalog\.validate_battle_pass_activation/,
  );
});

test("072 mantém o validador V1 completo como última autoridade de ativação", () => {
  assert.match(hardening, /level 1 must start at 0 XP/);
  assert.match(hardening, /XP thresholds must increase strictly/);
  assert.match(hardening, /credit matrix does not match V1/);
  assert.match(hardening, /cosmetic matrix does not match V1/);
  assert.match(hardening, /empty-level matrix does not match V1/);
  assert.match(hardening, /premium-initial-set/);
  assert.match(hardening, /pricing\.fixed_price=3000/);
  assert.match(hardening, /requires exactly one Elite offer covering the season/);
});


test("ativação exige rewards sazonais distintos por categoria", () => {
  assert.match(rewardIdentity, /distinct_dice_count <> 9/);
  assert.match(rewardIdentity, /distinct_territory_count <> 3/);
  assert.match(rewardIdentity, /distinct_background_count <> 2/);
  assert.match(rewardIdentity, /distinct_title_count <> 2/);
  assert.match(rewardIdentity, /9 distinct seasonal dice rewards/);
  assert.match(rewardIdentity, /3 distinct seasonal territory skins/);
  assert.match(rewardIdentity, /distinct free and Elite level-100 titles/);
  assert.match(rewardIdentity, /battle_pass_seasons_reward_identity_guard/);
});


test("ativação exige curva exata de 40k e perfil acumulativo V1", () => {
  assert.match(xpV1Integrity, /final_required_xp <> 40000/);
  assert.match(xpV1Integrity, /action_model_version=2/);
  assert.match(xpV1Integrity, /troop_placed_xp=1/);
  assert.match(xpV1Integrity, /troop_placed_cap_xp=60/);
  assert.match(xpV1Integrity, /card_trade_xp=20/);
  assert.match(xpV1Integrity, /card_trade_cap_xp=80/);
  assert.match(xpV1Integrity, /troop_lost_dice_xp=1/);
  assert.match(xpV1Integrity, /troop_lost_dice_cap_xp=50/);
  assert.match(xpV1Integrity, /enemy_troop_defeated_xp=2/);
  assert.match(xpV1Integrity, /enemy_troop_defeated_cap_xp=100/);
  assert.match(xpV1Integrity, /territory_first_conquest_xp=25/);
  assert.match(xpV1Integrity, /territory_second_conquest_xp=10/);
  assert.match(xpV1Integrity, /completion_xp=150/);
  assert.match(xpV1Integrity, /victory_bonus_xp=200/);
  assert.match(xpV1Integrity, /solo_human_bot_multiplier_bps=4000/);
  assert.match(xpV1Integrity, /battle_pass_seasons_xp_v1_guard/);
});
