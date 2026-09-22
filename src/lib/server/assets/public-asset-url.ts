import "server-only";

function normalizedPublicAssetBaseUrl() {
  const configured = process.env.ASSET_PUBLIC_BASE_URL?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
      return null;
    }
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/$/, "");
    return url;
  } catch {
    return null;
  }
}

export function publicAssetDeliveryUrl(objectKey: string) {
  const base = normalizedPublicAssetBaseUrl();
  if (!base) return null;

  const encodedPath = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const prefix = base.pathname ? `${base.pathname}/` : "/";
  base.pathname = `${prefix}${encodedPath}`;
  return base.toString();
}
