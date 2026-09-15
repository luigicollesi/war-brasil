import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("PROFILE V4 arsenal has a dedicated authenticated route and shared shell", async () => {
  const page = await source("src/app/profile/arsenal/page.tsx");

  assert.match(page, /auth\.api\.getSession/);
  assert.match(page, /redirect\("\/"\)/);
  assert.match(page, /activeSurface="arsenal"/);
  assert.match(page, /<ProfileArsenal/);
});

test("PROFILE V4 arsenal exposes exactly the four cosmetic bays", async () => {
  const arsenal = await source("src/components/profile/v4/profile-arsenal.tsx");

  assert.match(arsenal, /dice_attack/);
  assert.match(arsenal, /dice_defense/);
  assert.match(arsenal, /dice_neutral/);
  assert.match(arsenal, /territory_effect/);
  assert.match(arsenal, /Todos/);
  assert.match(arsenal, /Território/);
});

test("PROFILE V4 arsenal derives inventory from ownedItems and equips through the economy boundary", async () => {
  const arsenal = await source("src/components/profile/v4/profile-arsenal.tsx");

  assert.match(arsenal, /storefront\.ownedItems/);
  assert.match(arsenal, /\/api\/economy\/loadout/);
  assert.doesNotMatch(arsenal, /userId/);
  assert.doesNotMatch(arsenal, /price/);
});

test("PROFILE V4 territory bay preserves PlayerColor through the shared territory skin preview", async () => {
  const arsenal = await source("src/components/profile/v4/profile-arsenal.tsx");

  assert.match(arsenal, /TerritorySkinPreview/);
  assert.match(arsenal, /item\.slot === "territory_effect"/);
  assert.match(arsenal, /assetRef=\{cosmeticPreviewSource\(item\)\}/);
});
