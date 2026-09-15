import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const validatorPath = "scripts/validate-storefront-assets.mjs";
const validator = readFileSync(validatorPath, "utf8");
const collectionStorage = readFileSync(
  "src/lib/server/assets/collection-asset-storage.ts",
  "utf8",
);

test("assets:validate covers dice and storefront editorial objects", () => {
  assert.match(packageJson.scripts["assets:validate"], /validate-dice-assets\.mjs/);
  assert.match(packageJson.scripts["assets:validate"], /validate-storefront-assets\.mjs/);
});

test("storefront validator derives active exact keys from DB without ListObjects", () => {
  assert.match(validator, /FROM catalog\.collection_assets/);
  assert.match(validator, /asset\.active=TRUE/);
  assert.match(validator, /collection\.active=TRUE/);
  assert.match(validator, /validateCollectionAssetObject/);
  assert.doesNotMatch(validator, /ListObjects|listObjects|list_objects/i);
});

test("collection validation performs HEAD-style WebP validation through canonical key contract", () => {
  assert.match(collectionStorage, /validateCollectionAssetObject/);
  assert.match(collectionStorage, /validateWebPAssetObject/);
  assert.match(collectionStorage, /COLLECTION_ASSET_NOT_AVAILABLE/);
  assert.match(collectionStorage, /COLLECTION_ASSET_CONTENT_TYPE_INVALID/);
});
