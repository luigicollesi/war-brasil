const PROFILE_BACKGROUND_CACHE_NAME = "bellum-civile-profile-background-v1";
const PROFILE_BACKGROUND_STORAGE_PREFIX = "bellum-civile:profile-background:v1:";
export const PROFILE_BACKGROUND_UPDATED_EVENT =
  "bellum-civile:profile-background-updated";

function storageKey(handle: string) {
  return `${PROFILE_BACKGROUND_STORAGE_PREFIX}${handle.trim().toLowerCase()}`;
}

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

export function readCachedProfileBackgroundRef(handle: string) {
  if (!canUseBrowserStorage()) return null;
  try {
    return window.localStorage.getItem(storageKey(handle));
  } catch {
    return null;
  }
}

export function rememberProfileBackgroundRef(handle: string, assetRef: string) {
  if (!canUseBrowserStorage() || !assetRef) return;
  try {
    window.localStorage.setItem(storageKey(handle), assetRef);
  } catch {
    // Storage can be unavailable in private/restricted browsing modes.
  }
}

export async function warmProfileBackgroundAsset(assetRef: string) {
  if (
    !assetRef ||
    typeof window === "undefined" ||
    !("caches" in window)
  ) {
    return;
  }

  try {
    const cache = await window.caches.open(PROFILE_BACKGROUND_CACHE_NAME);
    if (await cache.match(assetRef)) return;

    const response = await fetch(assetRef, { cache: "force-cache" });
    if (!response.ok) return;
    await cache.put(assetRef, response.clone());
  } catch {
    // CSS can still load the canonical URL and use the normal HTTP cache.
  }
}


export type ProfileBackgroundUpdatedDetail = Readonly<{
  handle: string;
  assetRef: string;
}>;

export async function applyProfileBackgroundRef(
  handle: string,
  assetRef: string,
) {
  if (!canUseBrowserStorage() || !handle || !assetRef) return;

  rememberProfileBackgroundRef(handle, assetRef);
  await warmProfileBackgroundAsset(assetRef);

  window.dispatchEvent(
    new CustomEvent<ProfileBackgroundUpdatedDetail>(
      PROFILE_BACKGROUND_UPDATED_EVENT,
      {
        detail: {
          handle: handle.trim().toLowerCase(),
          assetRef,
        },
      },
    ),
  );
}

export async function resolveProfileBackgroundDisplayUrl(assetRef: string) {
  if (
    !assetRef ||
    typeof window === "undefined" ||
    !("caches" in window)
  ) {
    return assetRef;
  }

  try {
    const cache = await window.caches.open(PROFILE_BACKGROUND_CACHE_NAME);
    let response = await cache.match(assetRef);

    if (!response) {
      const networkResponse = await fetch(assetRef, { cache: "force-cache" });
      if (!networkResponse.ok) return assetRef;
      await cache.put(assetRef, networkResponse.clone());
      response = networkResponse;
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return assetRef;
  }
}
