import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

test("economy models product and purchase entitlements across three ownership domains", async () => {
  const migration = await source("src/lib/db/migrations/managed/051-economy-entitlements.sql");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.product_entitlements/);
  assert.match(migration, /'game_cosmetic','commander_title','profile_background'/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS economy\.purchase_entitlements/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.commander_title_pricing/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.profile_background_pricing/);
  assert.match(migration, /FROM catalog\.product_items/);
});

test("purchase grants each entitlement to its authoritative ownership table atomically", async () => {
  const repository = await source("src/lib/server/economy/entitlement-repository.ts");
  const service = await source("src/lib/server/economy/economy-service.ts");

  assert.match(repository, /INSERT INTO inventory\.cosmetics/);
  assert.match(repository, /INSERT INTO profile\.commander_titles/);
  assert.match(repository, /INSERT INTO profile\.commander_backgrounds/);
  assert.match(repository, /INSERT INTO economy\.purchase_entitlements/);
  assert.match(service, /lockProductEntitlementStats/);
  assert.match(service, /listLockedProductEntitlementsForPurchase/);
  assert.match(service, /grantEntitlementOwnership/);
  assert.match(service, /insertPurchaseEntitlement/);
  assert.match(service, /client\.query\("ROLLBACK"\)/);
});


test("profile appearance storefront exposes owned state and authoritative offer pricing without gameplay inventory", async () => {
  const route = await source("src/app/api/economy/profile-appearance/route.ts");
  const repository = await source(
    "src/lib/server/economy/profile-appearance-store-repository.ts",
  );
  const service = await source(
    "src/lib/server/economy/profile-appearance-store-service.ts",
  );

  assert.match(route, /getAuthenticatedSession\(request\)/);
  assert.match(repository, /catalog\.product_entitlements/);
  assert.match(repository, /profile\.commander_titles owned/);
  assert.match(repository, /profile\.commander_backgrounds owned/);
  assert.match(repository, /catalog\.commander_title_pricing/);
  assert.match(repository, /catalog\.profile_background_pricing/);
  assert.match(service, /quoteStorefrontProduct/);
  assert.match(service, /product_entitlement_count/);
  assert.match(service, /profileAppearanceAssetDeliveryPath/);
});
