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
