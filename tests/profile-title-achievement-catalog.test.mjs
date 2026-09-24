import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const migrationPath =
  "src/lib/db/migrations/managed/058-commander-title-achievement-catalog.sql";
const betaGrantMigrationPath =
  "src/lib/db/migrations/managed/059-beta-tester-auto-grant.sql";
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

  assert.match(spec, /Beta Tester automático implementado/i);
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


test("new auth users receive Beta Tester through an idempotent database trigger", () => {
  const migration = read(betaGrantMigrationPath);

  assert.match(migration, /CREATE OR REPLACE FUNCTION profile\.grant_beta_tester_on_auth_user_insert/);
  assert.match(migration, /AFTER INSERT ON auth\."user"/);
  assert.match(migration, /title\.beta-tester/);
  assert.match(migration, /acquisition_source/);
  assert.match(migration, /'promotion'/);
  assert.match(migration, /ON CONFLICT \(user_id, title_id\) DO NOTHING/);
  assert.match(migration, /commander_title_stats/);
  assert.doesNotMatch(migration, /pending_registration/);
});

test("owned title reading remains database-driven through appearance repository and service", () => {
  const repository = read("src/lib/server/profile/profile-appearance-repository.ts");
  const service = read("src/lib/server/profile/profile-appearance-service.ts");

  assert.match(repository, /FROM profile\.commander_titles owned/);
  assert.match(repository, /JOIN catalog\.commander_titles title ON title\.id=owned\.title_id/);
  assert.match(repository, /title\.display_text/);
  assert.match(repository, /title\.font_key/);
  assert.match(repository, /title\.style_key/);
  assert.match(repository, /title\.texture_ref/);
  assert.match(service, /displayText: row\.display_text/);
  assert.match(service, /fontKey: row\.font_key/);
  assert.match(service, /styleKey: row\.style_key/);
});


test("BETA TESTER keeps the approved drift recipe unchanged", () => {
  const migration = readFileSync(
    "src/lib/db/migrations/managed/058-commander-title-achievement-catalog.sql",
    "utf8",
  );
  assert.match(
    migration,
    /'BETA TESTER'[\s\S]{0,180}'cyan-holo-drift_glow-blue-medium'/,
  );
});
