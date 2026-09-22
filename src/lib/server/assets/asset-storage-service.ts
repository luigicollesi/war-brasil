import "server-only";

import {
  assetStorageConfigFromEnv,
  assertDiceAssetKey,
  assertTerritorySkinAssetKey,
  type AssetStorageConfig,
} from "./asset-storage-config";
import { assetDeliveryPath } from "./asset-delivery";
import {
  createPresignedAssetUrl,
  createPresignedDiceAssetUrl,
  validateDiceAssetObject,
  validateDiceCollection,
  validateTerritorySkinAssetObject,
} from "./asset-storage-s3";

let cachedConfig: AssetStorageConfig | null = null;

export function getAssetStorageConfig() {
  if (!cachedConfig) cachedConfig = assetStorageConfigFromEnv();
  return cachedConfig;
}

export function resetAssetStorageConfigForTests() {
  cachedConfig = null;
}

export function diceAssetDeliveryPath(objectKey: string) {
  return assetDeliveryPath(objectKey, {
    assertKey: assertDiceAssetKey,
    fallbackPath: "/api/assets/dice",
  });
}

export function territorySkinAssetDeliveryPath(objectKey: string) {
  return assetDeliveryPath(objectKey, {
    assertKey: assertTerritorySkinAssetKey,
    fallbackPath: "/api/assets/territory-skins",
  });
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

export function resolveTerritorySkinAssetReadUrl(
  objectKey: string,
  options?: Readonly<{
    expiresInSeconds?: number;
    now?: Date;
  }>,
) {
  return createPresignedAssetUrl(
    getAssetStorageConfig(),
    assertTerritorySkinAssetKey(objectKey),
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

export async function validateConfiguredTerritorySkinAsset(
  objectKey: string,
  fetchImpl: typeof fetch = fetch,
) {
  return validateTerritorySkinAssetObject(
    getAssetStorageConfig(),
    objectKey,
    fetchImpl,
  );
}

export async function validateConfiguredDiceCollection(
  storageSlug: string,
  fetchImpl: typeof fetch = fetch,
) {
  return validateDiceCollection(getAssetStorageConfig(), storageSlug, fetchImpl);
}
