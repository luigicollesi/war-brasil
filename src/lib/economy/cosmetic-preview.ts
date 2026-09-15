import type { CosmeticCatalogItem } from "./economy-contract";

function isClientDeliverableAssetRef(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}

export function cosmeticPreviewSource(item: CosmeticCatalogItem) {
  for (const candidate of [item.previewRef, item.assetRef]) {
    if (candidate && isClientDeliverableAssetRef(candidate)) return candidate;
  }
  return null;
}
