import "server-only";

import { publicAssetDeliveryUrl } from "./public-asset-url";

export type AssetKeyValidator = (value: string) => string;

export function assetDeliveryPath(
  objectKey: string,
  options: Readonly<{
    assertKey: AssetKeyValidator;
    fallbackPath: string;
  }>,
) {
  const key = options.assertKey(objectKey);
  return (
    publicAssetDeliveryUrl(key) ??
    `${options.fallbackPath}?key=${encodeURIComponent(key)}`
  );
}
