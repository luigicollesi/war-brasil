import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "src/lib/db/migrations/managed/072-battle-pass-catalog-hardening.sql",
  "utf8",
);

test("ativação exige curva completa de 100 níveis e nível 1 em zero XP", () => {
  assert.match(migration, /level_count <> 100/);
  assert.match(migration, /level_one_xp <> 0/);
  assert.match(migration, /required_total_xp <= previous_xp/);
});

test("ativação exige a matriz monetária V1 exata e nenhum crédito no nível 100", () => {
  assert.match(migration, /free_credit <> 1000/);
  assert.match(migration, /premium_credit <> 2500/);
  assert.match(migration, /credit rewards must grant at least 5/);
  assert.match(migration, /credit matrix does not match V1/);
  assert.match(migration, /level 100 cannot grant campaign credits/);

  for (const fragment of [
    "('free'::varchar,2::smallint,5::bigint)",
    "('free',99,50)",
    "('premium',1,5)",
    "('premium',99,100)",
  ]) {
    assert.ok(migration.includes(fragment), `missing V1 matrix row: ${fragment}`);
  }
});

test("ativação exige os 16 cosméticos nas posições e slots do SPEC", () => {
  assert.match(migration, /free_cosmetic_count <> 6/);
  assert.match(migration, /premium_cosmetic_count <> 10/);
  assert.match(migration, /premium-initial-set/);
  assert.match(migration, /\(15::smallint,'free'::varchar,'game_cosmetic'::varchar,'dice_attack'/);
  assert.match(migration, /\(75,'free','game_cosmetic','territory_skin'/);
  assert.match(migration, /\(100,'free','commander_title'/);
  assert.match(migration, /\(60,'premium','game_cosmetic','dice_attack'/);
  assert.match(migration, /\(95,'premium','profile_background'/);
  assert.match(migration, /\(100,'premium','commander_title'/);
});

test("ativação preserva exatamente os 19 níveis vazios definidos no SPEC", () => {
  assert.match(
    migration,
    /\(6::smallint\),\(9\),\(16\),\(19\),\(26\),\(29\),\(36\),\(39\),\(46\),\(49\),[\s\S]*\(56\),\(59\),\(66\),\(69\),\(76\),\(79\),\(86\),\(89\),\(96\)/,
  );
  assert.match(migration, /empty-level matrix does not match V1/);
});

test("ativação exige uma única oferta Elite de 3000 CR válida durante toda a temporada", () => {
  assert.match(migration, /entitlement_kind='battle_pass_access'/);
  assert.match(migration, /offer\.status='available'/);
  assert.match(migration, /offer\.currency_code='campaign-credit'/);
  assert.match(migration, /pricing\.fixed_price=3000/);
  assert.match(migration, /offer\.starts_at IS NULL OR offer\.starts_at <= NEW\.starts_at/);
  assert.match(migration, /offer\.ends_at IS NULL OR offer\.ends_at >= NEW\.ends_at/);
  assert.match(migration, /elite_offer_count <> 1/);
});
