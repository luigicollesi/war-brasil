import "server-only";

import { AssetStorageConfigError } from "./asset-storage-config";
import { createPresignedAssetUrl } from "./asset-storage-s3";
import { getAssetStorageConfig } from "./asset-storage-service";

const COLLECTION_ASSET_KEY_PATTERN =
  /^store\/collections\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:banner|background|logo)\.webp$/;

export function isCollectionAssetKey(value: string): boolean {
  return COLLECTION_ASSET_KEY_PATTERN.test(value);
}

export function assertCollectionAssetKey(value: string): string {
  if (!isCollectionAssetKey(value)) {
    throw new AssetStorageConfigError(
      "COLLECTION_ASSET_KEY_INVALID",
      "A referência editorial da coleção deve apontar para banner.webp, background.webp ou logo.webp no namespace store/collections/.",
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
