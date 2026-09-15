import "server-only";

import type { AssetStorageConfig } from "./asset-storage-config";
import { AssetStorageConfigError } from "./asset-storage-config";
import {
  createPresignedAssetUrl,
  validateWebPAssetObject,
  type WebPAssetObjectMetadata,
} from "./asset-storage-s3";
import { getAssetStorageConfig } from "./asset-storage-service";

const COLLECTION_ASSET_KEY_PATTERN =
  /^store\/collections\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$/;

export function isCollectionAssetKey(value: string): boolean {
  return COLLECTION_ASSET_KEY_PATTERN.test(value);
}

export function assertCollectionAssetKey(value: string): string {
  if (!isCollectionAssetKey(value)) {
    throw new AssetStorageConfigError(
      "COLLECTION_ASSET_KEY_INVALID",
      "A referência editorial da coleção deve ser uma object key WebP no namespace store/collections/<slug>/.",
    );
  }
  return value;
}

export function collectionAssetDeliveryPath(objectKey: string) {
  const key = assertCollectionAssetKey(objectKey);
  return `/api/assets/collections?key=${encodeURIComponent(key)}`;
}

export function resolveCollectionAssetReadUrl(
  objectKey: string,
  options?: Readonly<{
    expiresInSeconds?: number;
    now?: Date;
  }>,
) {
  return createPresignedAssetUrl(
    getAssetStorageConfig(),
    assertCollectionAssetKey(objectKey),
    {
      method: "GET",
      expiresInSeconds: options?.expiresInSeconds,
      now: options?.now,
    },
  );
}

export async function validateCollectionAssetObject(
  config: AssetStorageConfig,
  objectKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WebPAssetObjectMetadata> {
  return validateWebPAssetObject(
    config,
    objectKey,
    {
      assertKey: assertCollectionAssetKey,
      unavailableCode: "COLLECTION_ASSET_NOT_AVAILABLE",
      contentTypeCode: "COLLECTION_ASSET_CONTENT_TYPE_INVALID",
      label: "O asset editorial da coleção",
    },
    fetchImpl,
  );
}
