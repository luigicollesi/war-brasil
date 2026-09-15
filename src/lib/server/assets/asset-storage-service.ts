import "server-only";

import {
  assetStorageConfigFromEnv,
  assertDiceAssetKey,
  type AssetStorageConfig,
} from "./asset-storage-config";
import {
  createPresignedDiceAssetUrl,
  validateDiceAssetObject,
  validateDiceCollection,
} from "./asset-storage-s3";

let cachedConfig: AssetStorageConfig | null = null;

export function getAssetStorageConfig() {
  if (!cachedConfig) cachedConfig = assetStorageConfigFromEnv();
  return cachedConfig;
}

export function resetAssetStorageConfigForTests() {
  cachedConfig = null;
}

export function resolveDiceAssetReadUrl(
  objectKey: string,
  options?: Readonly<{
    expiresInSeconds?: number;
    now?: Date;
  }>,
) {
  return createPresignedDiceAssetUrl(
    getAssetStorageConfig(),
    assertDiceAssetKey(objectKey),
    {
      method: "GET",
      expiresInSeconds: options?.expiresInSeconds,
      now: options?.now,
    },
  );
}

export async function validateConfiguredDiceAsset(
  objectKey: string,
  fetchImpl: typeof fetch = fetch,
) {
  return validateDiceAssetObject(getAssetStorageConfig(), objectKey, fetchImpl);
}

export async function validateConfiguredDiceCollection(
  storageSlug: string,
  fetchImpl: typeof fetch = fetch,
) {
  return validateDiceCollection(getAssetStorageConfig(), storageSlug, fetchImpl);
}
