import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "src/lib/db/migrations/managed/072-battle-pass-catalog-integrity.sql",
  "utf8",
);

test("XP profiles são append-only e catálogo ativo/histórico é congelado", () => {
  assert.match(migration, /battle_pass_xp_profiles_append_only/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON catalog\.battle_pass_xp_profiles/);
  assert.match(migration, /battle_pass_seasons_mutation_guard/);
  assert.match(migration, /battle_pass_levels_mutation_guard/);
  assert.match(migration, /battle_pass_rewards_mutation_guard/);
  assert.match(migration, /battle_pass_pricing_mutation_guard/);
  assert.match(migration, /active or historical battle pass child catalog is immutable/);
});

test("ativação exige nível 1 em zero XP, matriz V1 e preço Elite de 3000 CR", () => {
  assert.match(migration, /level 1 must start at 0 XP/);
  assert.match(migration, /campaign-credit schedule does not match V1/);
  assert.match(migration, /cosmetic\/title\/background schedule does not match V1/);
  assert.match(migration, /pricing\.fixed_price=3000/);
  assert.match(migration, /'free'::varchar,15::smallint,'game_cosmetic'::varchar,'dice_attack'/);
  assert.match(migration, /'premium'::varchar,1::smallint,'game_cosmetic'::varchar,'territory_skin'/);
  assert.match(migration, /'premium'::varchar,100::smallint,'commander_title'::varchar,NULL::text/);
});
