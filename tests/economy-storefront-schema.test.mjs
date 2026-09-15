import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "src/lib/db/migrations/managed/043-economy-storefront-v2.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

function sqlBlock(startPattern, endPattern) {
  const start = migration.search(startPattern);
  assert.notEqual(start, -1, `bloco inicial não encontrado: ${startPattern}`);
  const tail = migration.slice(start);
  const end = tail.search(endPattern);
  return end < 0 ? tail : tail.slice(0, end);
}

test("STORE-01/06: migration separa collections, products e product_items de ownership", () => {
  assert.equal(existsSync(migrationPath), true);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.collections/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.products/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.product_items/);
  assert.match(migration, /product_type[\s\S]*single[\s\S]*bundle/i);
  assert.match(migration, /FOREIGN KEY \(cosmetic_id\)[\s\S]*REFERENCES catalog\.cosmetics\(id\)/i);
  assert.doesNotMatch(migration, /inventory\.products|profile\.product_loadout/);
});

test("STORE-02: territory_skin substitui territory_effect preservando dados existentes", () => {
  assert.match(migration, /UPDATE catalog\.cosmetics[\s\S]*territory_effect[\s\S]*territory_skin/i);
  assert.match(migration, /UPDATE inventory\.cosmetics[\s\S]*territory_effect[\s\S]*territory_skin/i);
  assert.match(migration, /UPDATE profile\.cosmetic_loadout[\s\S]*territory_effect[\s\S]*territory_skin/i);
  assert.match(migration, /UPDATE game\.player_cosmetic_loadouts[\s\S]*territory_effect[\s\S]*territory_skin/i);
  assert.match(
    migration,
    /CHECK \(slot IN \('dice_attack', 'dice_defense', 'dice_neutral', 'territory_skin'\)\)/,
  );
});

test("STORE-03/04/05: produtos suportam singles, bundles e desconto em basis points", () => {
  assert.match(migration, /bundle_discount_bps INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /bundle_discount_bps BETWEEN 0 AND 10000/);
  assert.match(migration, /INSERT INTO catalog\.products[\s\S]*'single'/i);
  assert.match(migration, /INSERT INTO catalog\.products[\s\S]*'bundle'/i);
  assert.match(migration, /INSERT INTO catalog\.product_items/i);
});

test("STORE-07: collection assets V1 usam apenas banner, background e logo", () => {
  const collectionAssets = sqlBlock(
    /CREATE TABLE IF NOT EXISTS catalog\.collection_assets/,
    /ALTER TABLE catalog\.cosmetics/,
  );

  assert.match(collectionAssets, /object_key TEXT NOT NULL/);
  assert.match(
    collectionAssets,
    /CHECK \(role IN \('banner', 'background', 'logo'\)\)/,
  );
  assert.match(collectionAssets, /active BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.doesNotMatch(collectionAssets, /'hero'|'card'|'thumbnail'/);
  assert.doesNotMatch(collectionAssets, /https?:\/\//i);

  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS catalog_collection_assets_one_active_role_uq[\s\S]*ON catalog\.collection_assets\(collection_id, role\)[\s\S]*WHERE active/i,
  );
});

test("STORE-06/07: Football é fixture dice-only com os três assets editoriais exatos", () => {
  assert.match(migration, /collection\.futebol|collection\.football/i);
  assert.match(migration, /store\/collections\/football\/banner\.webp/);
  assert.match(migration, /store\/collections\/football\/background\.webp/);
  assert.match(migration, /store\/collections\/football\/logo\.webp/);

  const footballAssets = [
    "store/collections/football/banner.webp",
    "store/collections/football/background.webp",
    "store/collections/football/logo.webp",
  ];
  for (const key of footballAssets) {
    assert.equal(migration.split(key).length - 1, 1, `${key} deve ter um único mapping seed`);
  }
});

test("STORE-10/11: pricing progressivo possui contador e tiers não sobrepostos", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.cosmetic_pricing/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.cosmetic_stats/);
  assert.match(migration, /acquisition_count BIGINT NOT NULL DEFAULT 0/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.price_tiers/);
  assert.match(migration, /acquisitions_from BIGINT NOT NULL/);
  assert.match(migration, /acquisitions_until BIGINT/);
  assert.match(migration, /EXCLUDE USING gist/i);
  assert.match(migration, /btree_gist/i);
});

test("STORE-13/14: offers suportam janela temporal e campanhas permanecem separadas de collections", () => {
  assert.match(migration, /ALTER TABLE catalog\.offers[\s\S]*starts_at TIMESTAMPTZ/);
  assert.match(migration, /ALTER TABLE catalog\.offers[\s\S]*ends_at TIMESTAMPTZ/);
  assert.match(migration, /ALTER TABLE catalog\.offers[\s\S]*active BOOLEAN/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.campaigns/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.campaign_offers/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.campaign_assets/);
});

test("purchase history recebe snapshots de produto, subtotal, desconto e preço por item", () => {
  assert.match(migration, /ALTER TABLE economy\.purchases[\s\S]*product_id TEXT/);
  assert.match(migration, /ALTER TABLE economy\.purchases[\s\S]*subtotal_price BIGINT/);
  assert.match(migration, /ALTER TABLE economy\.purchases[\s\S]*discount_bps INTEGER/);
  assert.match(migration, /ALTER TABLE economy\.purchase_items[\s\S]*unit_price BIGINT/);
});
