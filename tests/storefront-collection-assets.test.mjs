import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASSET_STORAGE_BUCKET_ENV,
  ASSET_STORAGE_DEV_BUCKET,
  ASSET_STORAGE_PROD_BUCKET,
  AssetStorageConfigError,
  assetStorageConfigFromEnv,
} from "../.test-build/server/assets/asset-storage-config.js";

const collectionStorage = readFileSync(
  "src/lib/server/assets/collection-asset-storage.ts",
  "utf8",
);

function collectionAssetPattern() {
  const match = collectionStorage.match(
    /const COLLECTION_ASSET_KEY_PATTERN\s*=\s*\/(.+)\/;/,
  );
  assert.ok(match, "collection asset key pattern must exist");
  return new RegExp(match[1]);
}

test("collection assets aceitam object keys WebP explícitas sem inferir papel pelo filename", () => {
  const pattern = collectionAssetPattern();

  for (const key of [
    "store/collections/football/banner.webp",
    "store/collections/football/identity-wide.webp",
    "store/collections/celestial/scene_2026.webp",
  ]) {
    assert.equal(pattern.test(key), true, key);
  }

  for (const key of [
    "store/collections/Football/banner.webp",
    "store/collections/football/banner.svg",
    "store/campaigns/football/banner.webp",
    "https://cdn.example.invalid/store/collections/football/banner.webp",
    "../store/collections/football/banner.webp",
  ]) {
    assert.equal(pattern.test(key), false, key);
  }

  assert.match(collectionStorage, /export function assertCollectionAssetKey/);
  assert.match(collectionStorage, /"COLLECTION_ASSET_KEY_INVALID"/);
  assert.match(
    collectionStorage,
    /return `\/api\/assets\/collections\?key=\$\{encodeURIComponent\(key\)\}`;/,
  );
});

test("configuração HTTPS exige bucket server-only explícito e aceita namespaces dev/prod distintos", () => {
  const base = {
    ASSET_STORAGE_URL: "https://abc123.r2.cloudflarestorage.com",
    ASSET_STORAGE_ACCESS_KEY_ID: "key",
    ASSET_STORAGE_SECRET_ACCESS_KEY: "secret",
  };

  assert.throws(
    () => assetStorageConfigFromEnv(base),
    (error) =>
      error instanceof AssetStorageConfigError &&
      error.code === "ASSET_STORAGE_BUCKET_MISSING",
  );

  const dev = assetStorageConfigFromEnv({
    ...base,
    [ASSET_STORAGE_BUCKET_ENV]: ASSET_STORAGE_DEV_BUCKET,
  });
  const prod = assetStorageConfigFromEnv({
    ...base,
    [ASSET_STORAGE_BUCKET_ENV]: ASSET_STORAGE_PROD_BUCKET,
  });

  assert.equal(dev.bucket, "war-brasil-assets-dev");
  assert.equal(prod.bucket, "war-brasil-assets-prod");
  assert.notEqual(dev.bucket, prod.bucket);
});
