import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "src/lib/db/migrations/managed/043-economy-storefront-v2.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

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

test("STORE-07: assets editoriais e assets canônicos usam papéis sem URL de ambiente", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.collection_assets/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.cosmetic_assets/);
  assert.match(migration, /object_key TEXT NOT NULL/);
  assert.match(migration, /hero[\s\S]*banner[\s\S]*card[\s\S]*logo[\s\S]*background/i);
  assert.doesNotMatch(migration, /https?:\/\//i);
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
