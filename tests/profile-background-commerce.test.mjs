import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "src/lib/db/migrations/managed/063-profile-background-commerce.sql",
  "utf8",
);
const appearanceRepository = readFileSync(
  "src/lib/server/economy/profile-appearance-store-repository.ts",
  "utf8",
);
const entitlementRepository = readFileSync(
  "src/lib/server/economy/entitlement-repository.ts",
  "utf8",
);

test("profile background commerce prices every active non-default background at 300 credits", () => {
  assert.match(migration, /INSERT INTO catalog\.profile_background_pricing/);
  assert.match(migration, /SELECT background\.id, 300/);
  assert.match(migration, /background\.is_active=TRUE/);
  assert.match(migration, /background\.is_default=FALSE/);
  assert.match(migration, /ON CONFLICT \(background_id\) DO UPDATE/);
  assert.match(migration, /fixed_price=EXCLUDED\.fixed_price/);
});

test("profile backgrounds use stable single products and entitlement membership", () => {
  assert.match(migration, /INSERT INTO catalog\.products/);
  assert.match(migration, /'product\.single\.' \|\| background\.id/);
  assert.match(migration, /'single'/);
  assert.match(migration, /bundle_discount_bps/);
  assert.match(migration, /INSERT INTO catalog\.product_entitlements/);
  assert.match(migration, /'profile_background'/);
  assert.match(migration, /background_id=EXCLUDED\.background_id/);
  assert.match(migration, /collection_id=NULL/);
});

test("profile background offers mirror permanent itemized single-item dice commerce", () => {
  assert.match(migration, /INSERT INTO catalog\.offers/);
  assert.match(migration, /'offer\.single\.' \|\| background\.id/);
  assert.match(migration, /'campaign-credit'/);
  assert.match(migration, /\b300\b/);
  assert.match(migration, /'available'/);
  assert.match(migration, /'itemized'/);
  assert.match(migration, /starts_at=NULL/);
  assert.match(migration, /ends_at=NULL/);
  assert.match(migration, /active=TRUE/);
});

test("default background is never converted into paid merchandise", () => {
  const defaultGuards = migration.match(/background\.is_default=FALSE/g) ?? [];
  assert.ok(defaultGuards.length >= 4);
  assert.doesNotMatch(migration, /profile\.background\.default['"]?\s*,\s*300/);
});

test("commander titles stay out of paid storefront while retaining future pricing capability", () => {
  assert.match(
    migration,
    /entitlement\.entitlement_kind='commander_title'/,
  );
  assert.match(migration, /status='retired'/);
  assert.match(migration, /active=FALSE/);
  assert.doesNotMatch(
    migration,
    /INSERT INTO catalog\.commander_title_pricing[\s\S]*SELECT/,
  );
});

test("appearance storefront reads only active offers and entitlement purchase path grants background ownership", () => {
  assert.match(appearanceRepository, /offer\.status='available'/);
  assert.match(appearanceRepository, /offer\.active=TRUE/);
  assert.match(appearanceRepository, /background\.is_default=FALSE/);
  assert.match(
    entitlementRepository,
    /INSERT INTO profile\.commander_backgrounds\([\s\S]*'purchase'/,
  );
});
