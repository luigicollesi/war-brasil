import "server-only";

let cachedConfiguredValue: string | undefined;
let cachedBaseUrl: string | null = null;
let hasCachedBaseUrl = false;

function normalizedPublicAssetBaseUrl() {
  const configured = process.env.ASSET_PUBLIC_BASE_URL?.trim();
  if (hasCachedBaseUrl && configured === cachedConfiguredValue) {
    return cachedBaseUrl;
  }

  cachedConfiguredValue = configured;
  hasCachedBaseUrl = true;
  cachedBaseUrl = null;

  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
      return null;
    }
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    cachedBaseUrl = url.toString().replace(/\/$/, "");
    return cachedBaseUrl;
  } catch {
    return null;
  }
}

export function resetPublicAssetDeliveryUrlForTests() {
  cachedConfiguredValue = undefined;
  cachedBaseUrl = null;
  hasCachedBaseUrl = false;
}

export function publicAssetDeliveryUrl(objectKey: string) {
  const base = normalizedPublicAssetBaseUrl();
  if (!base) return null;

  const encodedPath = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/${encodedPath}`;
}
