import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("lifecycle de match congela temporada/perfil e concede XP somente no encerramento autoritativo", () => {
  const game = read("src/lib/server/game-dice-balance-service.ts");
  const progression = read(
    "src/lib/server/progression/battle-pass-match-xp-service.ts",
  );

  assert.match(game, /resolveBattlePassMatchSnapshot/);
  assert.match(game, /battle_pass_season_id,battle_pass_xp_profile_id/);
  assert.match(game, /snapshotMatchParticipants/);
  assert.match(game, /left_at_snapshot/);
  assert.match(game, /await awardBattlePassMatchXp\(\s*client,\s*room\.current_match_id,?\s*\)/s);

  assert.match(progression, /progression\.battle_pass_xp_entries/);
  assert.match(progression, /ON CONFLICT \(season_id,user_id,source_type,source_key\) DO NOTHING/);
  assert.match(progression, /progression\.battle_pass_progress/);
  assert.doesNotMatch(progression, /window\\.|document\\.|localStorage|sessionStorage/);
});

test("migration 070 cria fundação de 100 níveis, claims e proteção de catálogo ativo", () => {
  const migration = read(
    "src/lib/db/migrations/managed/070-battle-pass-progression-foundation.sql",
  );

  assert.match(migration, /CREATE SCHEMA IF NOT EXISTS progression/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.battle_pass_seasons/);
  assert.match(migration, /max_level SMALLINT NOT NULL DEFAULT 100 CHECK \(max_level = 100\)/);
  assert.match(migration, /credit_amount >= 5/);
  assert.match(migration, /free track must grant exactly 1000 campaign credits/);
  assert.match(migration, /premium track must grant exactly 2500 campaign credits/);
  assert.match(migration, /battle pass level 100 cannot grant campaign credits/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS progression\.battle_pass_reward_claims/);
  assert.match(migration, /matches_battle_pass_snapshot_immutable/);
});
