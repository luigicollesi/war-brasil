import "server-only";

import { AssetStorageConfigError } from "../assets/asset-storage-config";
import { createPresignedAssetUrl } from "../assets/asset-storage-s3";
import { getAssetStorageConfig } from "../assets/asset-storage-service";

const PROFILE_BACKGROUND_KEY_PATTERN =
  /^cosmetics\/profile-backgrounds\/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$/;
const TITLE_TEXTURE_KEY_PATTERN =
  /^cosmetics\/title-textures\/[a-z0-9]+(?:[-_][a-z0-9]+)*\.webp$/;

export function isProfileBackgroundAssetKey(value: string) {
  return PROFILE_BACKGROUND_KEY_PATTERN.test(value);
}

export function isTitleTextureAssetKey(value: string) {
  return TITLE_TEXTURE_KEY_PATTERN.test(value);
}

export function assertProfileAppearanceAssetKey(value: string) {
  if (!isProfileBackgroundAssetKey(value) && !isTitleTextureAssetKey(value)) {
    throw new AssetStorageConfigError(
      "PROFILE_APPEARANCE_ASSET_KEY_INVALID",
      "O asset de aparência deve ser um WebP em cosmetics/profile-backgrounds/ ou cosmetics/title-textures/.",
    );
  }
  return value;
}

export function profileAppearanceAssetDeliveryPath(objectKey: string) {
  const key = assertProfileAppearanceAssetKey(objectKey);
  return `/api/assets/profile-appearance?key=${encodeURIComponent(key)}`;
}

export function resolveProfileAppearanceAssetReadUrl(
  objectKey: string,
  options?: Readonly<{
    expiresInSeconds?: number;
    now?: Date;
  }>,
) {
  return createPresignedAssetUrl(
    getAssetStorageConfig(),
    assertProfileAppearanceAssetKey(objectKey),
    {
      method: "GET",
      expiresInSeconds: options?.expiresInSeconds,
      now: options?.now,
    },
  );
}
