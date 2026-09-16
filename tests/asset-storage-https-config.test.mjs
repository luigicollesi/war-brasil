import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSET_STORAGE_BUCKET_ENV,
  ASSET_STORAGE_DEV_BUCKET,
  ASSET_STORAGE_PROD_BUCKET,
  ASSET_STORAGE_REGION,
  AssetStorageConfigError,
  assetStorageConfigFromEnv,
} from "../.test-build/server/assets/asset-storage-config.js";

const nativeR2Env = {
  ASSET_STORAGE_URL: "https://abc123.r2.cloudflarestorage.com",
  ASSET_STORAGE_ACCESS_KEY_ID: "ACCESS/KEY",
  ASSET_STORAGE_SECRET_ACCESS_KEY: "secret:with@reserved",
  [ASSET_STORAGE_BUCKET_ENV]: ASSET_STORAGE_DEV_BUCKET,
};

test("asset storage accepts the native Cloudflare R2 HTTPS S3 endpoint", () => {
  const config = assetStorageConfigFromEnv(nativeR2Env);

  assert.equal(config.accessKeyId, nativeR2Env.ASSET_STORAGE_ACCESS_KEY_ID);
  assert.equal(config.secretAccessKey, nativeR2Env.ASSET_STORAGE_SECRET_ACCESS_KEY);
  assert.equal(config.host, "abc123.r2.cloudflarestorage.com");
  assert.equal(config.endpoint, nativeR2Env.ASSET_STORAGE_URL);
  assert.equal(config.bucket, ASSET_STORAGE_DEV_BUCKET);
  assert.equal(config.region, ASSET_STORAGE_REGION);
});

test("native HTTPS configuration keeps credentials outside ASSET_STORAGE_URL", () => {
  for (const missing of ["ASSET_STORAGE_ACCESS_KEY_ID", "ASSET_STORAGE_SECRET_ACCESS_KEY"]) {
    const env = { ...nativeR2Env };
    delete env[missing];

    assert.throws(
      () => assetStorageConfigFromEnv(env),
      (error) =>
        error instanceof AssetStorageConfigError &&
        error.code === "ASSET_STORAGE_CREDENTIALS_MISSING" &&
        !error.message.includes(nativeR2Env.ASSET_STORAGE_SECRET_ACCESS_KEY),
    );
  }
});

test("native HTTPS configuration falls back to the legacy production bucket when bucket is omitted", () => {
  const env = { ...nativeR2Env };
  delete env[ASSET_STORAGE_BUCKET_ENV];

  const config = assetStorageConfigFromEnv(env);
  assert.equal(config.bucket, ASSET_STORAGE_PROD_BUCKET);
});

test("native HTTPS endpoint rejects credentials, bucket paths and arbitrary query parameters", () => {
  for (const value of [
    "https://key:secret@abc123.r2.cloudflarestorage.com",
    "https://abc123.r2.cloudflarestorage.com/war-brasil-assets-dev",
    "https://abc123.r2.cloudflarestorage.com?region=auto",
  ]) {
    assert.throws(
      () => assetStorageConfigFromEnv({ ...nativeR2Env, ASSET_STORAGE_URL: value }),
      AssetStorageConfigError,
    );
  }
});

test("native HTTPS endpoint supports documented R2 jurisdiction hosts", () => {
  for (const jurisdiction of ["eu", "us", "fedramp"]) {
    const endpoint = `https://abc123.${jurisdiction}.r2.cloudflarestorage.com`;
    const config = assetStorageConfigFromEnv({ ...nativeR2Env, ASSET_STORAGE_URL: endpoint });
    assert.equal(config.endpoint, endpoint);
    assert.equal(config.host, new URL(endpoint).hostname);
  }
});
