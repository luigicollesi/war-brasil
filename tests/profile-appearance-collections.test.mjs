import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "src/lib/db/migrations/managed/064-profile-appearance-collections.sql",
  "utf8",
);
const backgroundCommerce = readFileSync(
  "src/lib/db/migrations/managed/063-profile-background-commerce.sql",
  "utf8",
);

test("profile backgrounds and commander titles can belong to collections", () => {
  assert.match(migration, /ALTER TABLE catalog\.profile_backgrounds[\s\S]*ADD COLUMN IF NOT EXISTS collection_id TEXT/);
  assert.match(migration, /ALTER TABLE catalog\.commander_titles[\s\S]*ADD COLUMN IF NOT EXISTS collection_id TEXT/);
  assert.match(migration, /profile_backgrounds_collection_fkey/);
  assert.match(migration, /commander_titles_collection_fkey/);
  assert.match(migration, /REFERENCES catalog\.collections\(id\)/);
  assert.match(migration, /ON DELETE SET NULL/);
});

test("existing themed backgrounds are backfilled into their collections", () => {
  for (const pair of [
    ["profile.background.viking", "collection.viking"],
    ["profile.background.cat", "collection.cat"],
    ["profile.background.dog", "collection.dog"],
    ["profile.background.football", "collection.football"],
  ]) {
    assert.match(migration, new RegExp(pair[0].replaceAll(".", "\\.") + "['\"] THEN ['\"]" + pair[1].replaceAll(".", "\\.")));
  }
});

test("default background remains outside collection membership and paid commerce", () => {
  assert.doesNotMatch(migration, /WHEN 'profile\.background\.default'/);
  assert.match(backgroundCommerce, /background\.is_default=FALSE/);
});

test("individual background offers remain commercially independent from collection activation", () => {
  assert.match(
    migration,
    /Individual profile-background products remain independent permanent products/,
  );
  assert.match(
    migration,
    /UPDATE catalog\.products product[\s\S]*SET collection_id=NULL/,
  );
});

test("title collection membership does not activate title commerce", () => {
  assert.match(migration, /catalog\.commander_titles/);
  assert.match(
    backgroundCommerce,
    /entitlement\.entitlement_kind='commander_title'/,
  );
  assert.match(backgroundCommerce, /status='retired'/);
  assert.match(backgroundCommerce, /active=FALSE/);
});


test("appearance storefront projects collection membership for backgrounds and titles", () => {
  const contract = readFileSync(
    "src/lib/economy/profile-appearance-store-contract.ts",
    "utf8",
  );
  const repository = readFileSync(
    "src/lib/server/economy/profile-appearance-store-repository.ts",
    "utf8",
  );
  const service = readFileSync(
    "src/lib/server/economy/profile-appearance-store-service.ts",
    "utf8",
  );

  assert.match(contract, /collectionId: string \| null/);
  assert.match(repository, /title\.collection_id/);
  assert.match(repository, /background\.collection_id/);
  assert.match(service, /collectionId: row\.collection_id/);
});

test("mixed collection bundles can grant gameplay cosmetics, backgrounds and titles atomically", () => {
  const entitlementMigration = readFileSync(
    "src/lib/db/migrations/managed/051-economy-entitlements.sql",
    "utf8",
  );
  const service = readFileSync(
    "src/lib/server/economy/economy-service.ts",
    "utf8",
  );
  const repository = readFileSync(
    "src/lib/server/economy/entitlement-repository.ts",
    "utf8",
  );

  assert.match(
    entitlementMigration,
    /entitlement_kind IN \('game_cosmetic','commander_title','profile_background'\)/,
  );
  assert.match(service, /lockProductEntitlementStats/);
  assert.match(service, /listLockedProductEntitlementsForPurchase/);
  assert.match(service, /grantEntitlementOwnership/);
  assert.match(repository, /entitlement_kind === "game_cosmetic"/);
  assert.match(repository, /entitlement_kind === "commander_title"/);
  assert.match(repository, /profile\.commander_backgrounds/);
});

test("collection promotions apply to explicit collection products independently of item membership metadata", () => {
  const quoteRepository = readFileSync(
    "src/lib/server/economy/storefront-quote-repository.ts",
    "utf8",
  );

  assert.match(quoteRepository, /product\.collection_id/);
  assert.match(quoteRepository, /lockStorefrontCollectionPromotion/);
  assert.match(
    quoteRepository,
    /WHERE collection\.id=\$1[\s\S]*collection\.active=TRUE/,
  );
});
