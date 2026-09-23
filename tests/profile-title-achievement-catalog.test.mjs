import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const migrationPath =
  "src/lib/db/migrations/managed/058-commander-title-achievement-catalog.sql";
const specPath = "docs/pre-game/profile/title-achievements/SPEC.md";

const expectedTitles = [
  ["title.beta-tester", "BETA TESTER", "epic", "tactical-tech", "cyan-holo-drift_glow-blue-medium"],
  ["title.first-victory", "VITORIOSO", "uncommon", "command-display", "bronze-metal"],
  ["title.total-conquest-1", "CONQUISTADOR", "rare", "military-stencil", "red-metal_glow-red-soft"],
  ["title.total-conquest-10", "DOMINADOR", "epic", "military-stencil", "crimson-metal-sheen_glow-red-medium"],
  ["title.total-conquest-100", "IMPERADOR", "legendary", "imperial", "gold-metal-sheen_glow-gold-strong-breathe"],
  ["title.victories-1000", "SOBERANO", "legendary", "imperial", "night-aurora-drift_glow-gold-strong"],
  ["title.store-purchase", "PATRONO", "rare", "ceremonial", "bronze-satin_glow-amber-medium"],
  ["title.store-spend-100-brl", "GRÃO-PATRONO", "epic", "ceremonial", "gold-satin-sheen_glow-amber-medium"],
  ["title.store-spend-1000-brl", "MECENAS", "legendary", "ceremonial", "gold-metal-sheen_glow-gold-strong-breathe"],
];

test("achievement title migration seeds the agreed catalogue without pricing", () => {
  const migration = read(migrationPath);

  for (const [id, display, rarity, font, style] of expectedTitles) {
    assert.ok(migration.includes("'" + id + "'"), id);
    assert.ok(migration.includes("'" + display + "'"), display);
    assert.ok(migration.includes("'" + rarity + "'"), rarity);
    assert.ok(migration.includes("'" + font + "'"), font);
    assert.ok(migration.includes("'" + style + "'"), style);
    assert.ok(style.length <= 48, style + " exceeds style_key storage");
  }

  assert.match(migration, /ON CONFLICT \(id\) DO UPDATE/);
  assert.match(migration, /DELETE FROM catalog\.commander_title_pricing/);
  assert.doesNotMatch(migration, /INSERT INTO profile\.commander_titles/);
});

test("achievement title spec keeps grants deferred and conditions server-authoritative", () => {
  const spec = read(specPath);

  assert.match(spec, /concessão automática ainda não implementada/i);
  assert.match(spec, /acquisition_source='promotion'/);
  assert.match(spec, /acquisition_source='reward'/);
  assert.match(spec, /1\.000 vitórias/);
  assert.match(spec, /100 vitórias controlando todos os territórios/);
  assert.match(spec, /gasto_liquido_brl > 100,00/);
  assert.match(spec, /gasto_liquido_brl > 1000,00/);
  assert.match(spec, /MUST NOT depender de um literal `42`/);
  assert.match(spec, /Débitos de `campaign-credit` MUST NOT ser interpretados como valor BRL/);
  assert.match(spec, /grantCommanderTitle/);
});
