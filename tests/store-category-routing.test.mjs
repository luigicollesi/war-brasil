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
  const contract = await source("src/lib/economy/store-category-contract.ts");

  for (const category of ["dice", "territories", "backgrounds", "titles"]) {
    assert.match(contract, new RegExp(`["']${category}["']`));
    assert.match(component, /\/profile\/store\/category\/\$\{id\}/);
  }

  assert.match(page, /isStoreCategoryId/);
  assert.match(page, /STORE_CATEGORY_META/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /params:\s*Promise<\{\s*category:\s*string\s*\}>/);
});

test("store category route uses category-scoped server reads and isolates appearance loading", async () => {
  const page = await source("src/app/profile/store/category/[category]/page.tsx");

  assert.match(page, /getEconomyStoreCategory/);
  assert.match(page, /getEconomyWallet/);
  assert.match(page, /getProfileAppearanceStorefront/);
  assert.match(page, /category === "dice" \|\| category === "territories"/);
  assert.match(page, /Promise\.all/);
  assert.doesNotMatch(page, /getEconomyStorefront/);
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


test("store category route uses the private profile shell and keeps scoped reads parallel", async () => {
  const page = await source("src/app/profile/store/category/[category]/page.tsx");
  const styles = await source("src/components/profile/v4/profile-store-category.module.css");

  assert.match(page, /ProfileShell/);
  assert.match(page, /getOwnCommanderProfile/);
  assert.match(page, /Promise\.all/);
  assert.match(page, /activeSurface="store"/);
  assert.match(styles, /\.categoryNav\s*\{[\s\S]*top:\s*78px/);
  assert.match(
    styles,
    /@media \(max-width: 980px\)[\s\S]*\.categoryNav\s*\{\s*top:\s*8px/,
  );
});

test("gameplay category reads are filtered in SQL before projection", async () => {
  const service = await source("src/lib/server/economy/economy-service.ts");
  const repository = await source("src/lib/server/economy/economy-storefront-repository.ts");
  const quoteRepository = await source("src/lib/server/economy/storefront-quote-repository.ts");

  assert.match(service, /listStorefrontCategoryOfferItems\(userId, slots\)/);
  assert.match(service, /listActiveStorefrontCategoryQuoteItems\(userId, slots\)/);
  assert.match(repository, /product\.collection_id IS NULL/);
  assert.match(repository, /item\.slot = ANY\(\$2::varchar\[\]\)/);
  assert.match(quoteRepository, /product\.collection_id IS NULL/);
  assert.match(quoteRepository, /item\.slot = ANY\(\$2::varchar\[\]\)/);
});


test("category projection only evaluates offers returned by the scoped item query", async () => {
  const service = await source("src/lib/server/economy/economy-service.ts");

  assert.match(service, /const categoryOfferIds = new Set\(offerItemRows\.map\(\(row\) => row\.offer_id\)\)/);
  assert.match(
    service,
    /product\.collection_id === null && categoryOfferIds\.has\(product\.offer_id\)/,
  );
  assert.match(
    service,
    /offerRows\.filter\(\(offer\) => categoryOfferIds\.has\(offer\.id\)\)/,
  );
  assert.doesNotMatch(
    service,
    /standaloneProductRows\.map\(\(product\) => product\.offer_id\)/,
  );
});

test("category loading and error surfaces never fall back to the profile command header", async () => {
  const errorPage = await source("src/app/profile/store/category/[category]/error.tsx");
  const loadingPage = await source("src/app/profile/store/category/[category]/loading.tsx");
  const boundary = await source("src/components/profile/v4/store-category-boundary.tsx");

  assert.match(errorPage, /StoreCategoryBoundary/);
  assert.match(loadingPage, /StoreCategoryBoundary/);
  assert.match(boundary, /href="\/profile\/store"/);
  assert.doesNotMatch(boundary, /Bellum Civile/i);
  assert.doesNotMatch(boundary, /QUARTEL DO COMANDANTE/);
  assert.doesNotMatch(boundary, /ProfileV4Boundary/);
  assert.doesNotMatch(errorPage, /ProfileV4Boundary/);
  assert.doesNotMatch(loadingPage, /ProfileV4Boundary/);
});


test("store category route keeps JSX outside data-loading try/catch", async () => {
  const page = await source("src/app/profile/store/category/[category]/page.tsx");

  const tryStart = page.indexOf("  try {");
  const catchStart = page.indexOf("  } catch (error)", tryStart);
  const guardedReadBlock = page.slice(tryStart, catchStart);

  assert.ok(tryStart >= 0);
  assert.ok(catchStart > tryStart);
  assert.match(guardedReadBlock, /Promise\.all/);
  assert.doesNotMatch(guardedReadBlock, /<ProfileShell/);
  assert.doesNotMatch(guardedReadBlock, /<ProfileStoreCategory/);
  assert.match(page.slice(catchStart), /<ProfileShell/);
});


test("server route never imports runtime category values from a client component", async () => {
  const page = await source("src/app/profile/store/category/[category]/page.tsx");
  const component = await source("src/components/profile/v4/profile-store-category.tsx");
  const contract = await source("src/lib/economy/store-category-contract.ts");

  assert.match(component, /^"use client";/);
  assert.match(contract, /export const STORE_CATEGORY_IDS/);
  assert.match(contract, /export function isStoreCategoryId/);
  assert.match(page, /from "@\/src\/lib\/economy\/store-category-contract"/);
  assert.doesNotMatch(
    page,
    /STORE_CATEGORY_IDS[\s\S]*from "@\/src\/components\/profile\/v4\/profile-store-category"/,
  );
});


test("background category shows collection progress and locks purchase until complete", async () => {
  const component = await source(
    "src/components/profile/v4/profile-store-category.tsx",
  );
  const styles = await source(
    "src/components/profile/v4/profile-store-category.module.css",
  );

  assert.match(component, /item\.collectionUnlock/);
  assert.match(component, /collectionUnlock\.ownedCount/);
  assert.match(component, /collectionUnlock\.totalCount/);
  assert.match(component, /collectionUnlock\.complete/);
  assert.match(component, /"BLOQUEADO"/);
  assert.match(component, /!offer\.purchasable/);
  assert.match(styles, /\.collectionProgress/);
  assert.match(styles, /data-collection-locked/);
});
