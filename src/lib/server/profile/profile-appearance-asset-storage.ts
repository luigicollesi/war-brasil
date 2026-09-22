import "server-only";

import { AssetStorageConfigError } from "../assets/asset-storage-config";
import { resolveCollectionAssetReadUrl } from "../assets/collection-asset-storage";
import { createPresignedAssetUrl } from "../assets/asset-storage-s3";
import { getAssetStorageConfig } from "../assets/asset-storage-service";
import { assetDeliveryPath } from "../assets/asset-delivery";

const PROFILE_BACKGROUND_KEY_PATTERN =
  /^cosmetics\/profile-backgrounds\/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$/;
const SHARED_COLLECTION_BACKGROUND_KEY_PATTERN =
  /^store\/collections\/[a-z0-9]+(?:-[a-z0-9]+)*\/background\.webp$/;
const TITLE_TEXTURE_KEY_PATTERN =
  /^cosmetics\/title-textures\/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$/;

export function isProfileBackgroundAssetKey(value: string) {
  return (
    PROFILE_BACKGROUND_KEY_PATTERN.test(value) ||
    SHARED_COLLECTION_BACKGROUND_KEY_PATTERN.test(value)
  );
}

export function isTitleTextureAssetKey(value: string) {
  return TITLE_TEXTURE_KEY_PATTERN.test(value);
}

function isSharedCollectionBackgroundAssetKey(value: string) {
  return SHARED_COLLECTION_BACKGROUND_KEY_PATTERN.test(value);
}

export function assertProfileAppearanceAssetKey(value: string) {
  if (!isProfileBackgroundAssetKey(value) && !isTitleTextureAssetKey(value)) {
    throw new AssetStorageConfigError(
      "PROFILE_APPEARANCE_ASSET_KEY_INVALID",
      "O asset de aparência deve ser um WebP de background ou textura de título em um namespace permitido.",
    );
  }
  return value;
}

export function profileAppearanceAssetDeliveryPath(objectKey: string) {
  return assetDeliveryPath(objectKey, {
    assertKey: assertProfileAppearanceAssetKey,
    fallbackPath: "/api/assets/profile-appearance",
  });
}

export function resolveProfileAppearanceAssetReadUrl(
  objectKey: string,
  options?: Readonly<{
    expiresInSeconds?: number;
    now?: Date;
  }>,
) {
  const key = assertProfileAppearanceAssetKey(objectKey);

  if (isSharedCollectionBackgroundAssetKey(key)) {
    return resolveCollectionAssetReadUrl(key, options);
  }

  return createPresignedAssetUrl(
    getAssetStorageConfig(),
    key,
    {
      method: "GET",
      expiresInSeconds: options?.expiresInSeconds,
      now: options?.now,
    },
  );
}
