import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const storePath = "src/components/profile/v4/profile-store.tsx";

function read(path) {
  return readFileSync(path, "utf8");
}

test("store discovery routes normal offers and collections into the dedicated showcase", () => {
  const store = read(storePath);

  assert.match(store, /function showcaseHref/);
  assert.match(store, /\/profile\/store\/showcase\/\$\{kind\}\/\$\{encodeURIComponent\(id\)\}/);
  assert.match(store, /showcaseHref\("offer",\s*offer\.id/);
  assert.match(store, /showcaseHref\("collection",\s*collection\.id/);
  assert.match(store, /showcaseHref\("collection",\s*featuredCollection\.id/);
  assert.match(store, /showcaseHref\("offer",\s*offer\.id,\s*skin\.id/);
});

test("store discovery no longer owns permanent inspection or collection modal state", () => {
  const store = read(storePath);

  assert.doesNotMatch(store, /InspectionContent/);
  assert.doesNotMatch(store, /inspectionOpen/);
  assert.doesNotMatch(store, /collectionModalOpen/);
  assert.doesNotMatch(store, /selectedCollectionId/);
  assert.doesNotMatch(store, /profile-store-mobile-inspection\.module\.css/);
  assert.doesNotMatch(store, /profile-store-collection-modal\.module\.css/);
  assert.doesNotMatch(store, /aria-modal="true"/);
});

test("store cards are discovery surfaces; acquisition is delegated to showcase", () => {
  const store = read(storePath);

  assert.doesNotMatch(store, /async function purchase\(/);
  assert.doesNotMatch(store, /pendingOfferId/);
  assert.doesNotMatch(store, /purchaseFeedback/);
  assert.match(store, /INSPECIONAR/);
});
