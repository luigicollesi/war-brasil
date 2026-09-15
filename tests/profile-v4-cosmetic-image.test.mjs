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
  assert.match(image, /setFailed\(true\)/);
  assert.match(image, /if \(!src \|\| failed\)/);
  assert.match(image, /Prévia indisponível/);
});

test("PROFILE V4 resets failed preview when the selected asset changes", async () => {
  const image = await source("src/components/profile/v4/profile-cosmetic-image.tsx");

  assert.match(image, /useEffect/);
  assert.match(image, /setFailed\(false\)/);
  assert.match(image, /\[src\]/);
});

test("Arsenal and Store reuse the resilient cosmetic image boundary", async () => {
  const arsenal = await source("src/components/profile/v4/profile-arsenal.tsx");
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(arsenal, /ProfileCosmeticImage/);
  assert.match(store, /ProfileCosmeticImage/);
});