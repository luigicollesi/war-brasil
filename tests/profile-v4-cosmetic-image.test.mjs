import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("PROFILE V4 cosmetic image falls back after delivery failure", async () => {
  const image = await source("src/components/profile/v4/profile-cosmetic-image.tsx");

  assert.match(image, /onError=/);
  assert.match(image, /setFailedSrc\(src\)/);
  assert.match(image, /failedSrc === src/);
  assert.match(image, /Prévia indisponível/);
});

test("PROFILE V4 scopes a delivery failure to the source that actually failed", async () => {
  const image = await source("src/components/profile/v4/profile-cosmetic-image.tsx");

  assert.match(image, /failedSrc/);
  assert.doesNotMatch(image, /useEffect/);
  assert.doesNotMatch(image, /setFailed\(false\)/);
});

test("Arsenal and Store reuse the resilient cosmetic image boundary", async () => {
  const arsenal = await source("src/components/profile/v4/profile-arsenal.tsx");
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(arsenal, /ProfileCosmeticImage/);
  assert.match(store, /ProfileCosmeticImage/);
});