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
