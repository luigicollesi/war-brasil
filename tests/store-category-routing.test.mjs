import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("store category route accepts the four supported catalog flows and rejects unknown categories", async () => {
  const page = await source("src/app/profile/store/category/[category]/page.tsx");
  const component = await source("src/components/profile/v4/profile-store-category.tsx");

  for (const category of ["dice", "territories", "backgrounds", "titles"]) {
    assert.match(component, new RegExp(`["']${category}["']`));
    assert.match(component, /\/profile\/store\/category\/\$\{id\}/);
  }

  assert.match(page, /STORE_CATEGORY_IDS/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /params:\s*Promise<\{\s*category:\s*string\s*\}>/);
});

test("store category route uses server storefront services instead of client catalog fetching", async () => {
  const page = await source("src/app/profile/store/category/[category]/page.tsx");

  assert.match(page, /getEconomyStorefront/);
  assert.match(page, /getProfileAppearanceStorefront/);
  assert.match(page, /Promise\.all/);
  assert.doesNotMatch(page, /fetch\(/);
});

test("store category surface keeps a persistent guide between all four catalog flows", async () => {
  const component = await source("src/components/profile/v4/profile-store-category.tsx");
  const styles = await source("src/components/profile/v4/profile-store-category.module.css");

  assert.match(component, /aria-label="Guia rápido de categorias"/);
  assert.match(component, /STORE_CATEGORY_IDS\.map/);
  assert.match(component, /aria-current=\{category === id \? "page" : undefined\}/);
  assert.match(styles, /\.categoryNav\s*\{[\s\S]*position:\s*sticky/);
});

test("appearance categories render canonical background and title previews", async () => {
  const component = await source("src/components/profile/v4/profile-store-category.tsx");

  assert.match(component, /item\.kind === "profile_background"/);
  assert.match(component, /item\.kind === "commander_title"/);
  assert.match(component, /ProfileTitleRenderer/);
  assert.match(component, /item\.previewRef \?\? item\.assetRef/);
});

test("all category purchases reuse the authoritative economy purchase client", async () => {
  const component = await source("src/components/profile/v4/profile-store-category.tsx");

  assert.match(component, /purchaseShowcaseOffer/);
  assert.match(component, /expectedPrice:\s*offer\.price/);
  assert.match(component, /ECONOMY_PRICE_CHANGED/);
  assert.match(component, /ECONOMY_INSUFFICIENT_BALANCE/);
  assert.doesNotMatch(component, /wallet\.balance\s*-/);
});
