import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("PROFILE V4 arsenal has a dedicated authenticated route and shared shell", async () => {
  const page = await source("src/app/profile/arsenal/page.tsx");

  assert.match(page, /getAuthenticatedSessionForReadHeaders/);
  assert.match(page, /redirect\("\/"\)/);
  assert.match(page, /activeSurface="arsenal"/);
  assert.match(page, /<ProfileArsenal/);
});

test("PROFILE V4 arsenal exposes exactly the four cosmetic bays", async () => {
  const arsenal = await source("src/components/profile/v4/profile-arsenal.tsx");

  assert.match(arsenal, /dice_attack/);
  assert.match(arsenal, /dice_defense/);
  assert.match(arsenal, /dice_neutral/);
  assert.match(arsenal, /territory_skin/);
  assert.doesNotMatch(arsenal, /territory_effect/);
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
  assert.match(arsenal, /item\.slot === "territory_skin"/);
  assert.match(arsenal, /assetRef=\{cosmeticPreviewSource\(item\)\}/);
});


test("PROFILE V4 arsenal uses borderless store-like cards with hover and focus identification", async () => {
  const styles = await source("src/components/profile/v4/profile-arsenal.module.css");

  assert.match(
    styles,
    /\.hero,\s*\.bays,\s*\.inventory\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/,
  );
  assert.match(styles, /\.bay\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/);
  assert.match(
    styles,
    /\.inventoryCard\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/,
  );
  assert.match(
    styles,
    /\.inspector\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/,
  );

  assert.match(styles, /\.bay:hover\s*\{[^}]*transform:\s*translateY\(-4px\)/);
  assert.match(
    styles,
    /\.inventoryCard:hover,\s*\.inventoryCard:focus-visible\s*\{[^}]*transform:\s*translateY\(-4px\)/,
  );
  assert.match(
    styles,
    /\.inventoryCard:hover \.cardVisual::before,[\s\S]*\.inventoryCard\[data-selected="true"\] \.cardVisual::before\s*\{[^}]*opacity:\s*1;[^}]*transform:\s*scale\(1\.06\)/,
  );
  assert.match(
    styles,
    /@media\s*\(hover:\s*none\)[\s\S]*\.bay:hover,[\s\S]*\.inventoryCard:hover\s*\{[^}]*transform:\s*none;/,
  );
});
