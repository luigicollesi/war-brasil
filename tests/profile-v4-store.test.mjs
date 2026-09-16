import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("PROFILE V4 store is a dedicated Intendência surface inside the shared shell", async () => {
  const page = await source("src/app/profile/store/page.tsx");

  assert.match(page, /activeSurface="store"/);
  assert.match(page, /<ProfileStore/);
  assert.doesNotMatch(page, /<EconomyStorefront/);
});

test("PROFILE V4 store consumes server-derived collections, territory skins, offers and packs", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /storefront\.collections/);
  assert.match(store, /storefront\.territorySkins/);
  assert.match(store, /storefront\.offers/);
  assert.match(store, /storefront\.creditPacks/);
  assert.match(store, /offer\.price/);
  assert.match(store, /pack\.creditAmount/);
  assert.match(store, /pack\.priceBrlCents/);
  assert.doesNotMatch(store, /R\$\s*\d/);
  assert.doesNotMatch(store, /price:\s*\d/);
  assert.doesNotMatch(store, /creditAmount:\s*\d/);
  assert.doesNotMatch(store, /userId/);
});

test("PROFILE V4 store exposes Destaques, Dados, Territórios e Coleções as primary discovery surfaces", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  for (const label of ["DESTAQUES", "DADOS", "TERRITÓRIOS", "COLEÇÕES"]) {
    assert.match(store, new RegExp(label));
  }
  for (const anchor of ["store-highlights", "store-dice", "store-territories", "store-collections"]) {
    assert.match(store, new RegExp(`id=\\"${anchor}\\"|href=\\"#${anchor}\\"`));
  }
});

test("PROFILE V4 store uses the canonical campaign-credit coin beside monetary values", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /src="\/coin\.svg"/);
  assert.match(store, /offer\.price/);
  assert.match(store, /pack\.creditAmount/);
  assert.doesNotMatch(store, />\s*◈\s*</);
});

test("PROFILE V4 store exposes ownership-aware discovery without becoming purchase authority", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /offer\.fullyOwned/);
  assert.match(store, /offer\.partiallyOwned/);
  assert.match(store, /offer\.ownedCount/);
  assert.match(store, /offer\.totalCount/);
  assert.match(store, /offer\.purchasable/);
  assert.match(store, /POSSUÍDO/);
  assert.match(store, /INDISPONÍVEL/);
  assert.match(store, /INSPECIONAR/);
  assert.doesNotMatch(store, /\/api\/economy\/purchases/);
});

test("PROFILE V4 collection discovery uses only its banner and routes detail into the showcase", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /collection\.assets\.banner/);
  assert.match(store, /showcaseHref\("collection",\s*collection\.id/);
  assert.match(store, /showcaseHref\("collection",\s*featuredCollection\.id/);
  assert.match(
    store,
    /function collectionProgressLabel[\s\S]*collection\.ownedCount[\s\S]*collection\.totalCount/,
  );
  assert.doesNotMatch(store, /selectedCollection\.assets\.(?:background|logo)/);
  assert.doesNotMatch(store, /aria-modal="true"/);
});

test("PROFILE V4 collection banner is an accessible showcase link", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /collection\.assets\.banner/);
  assert.match(store, /href=\{showcaseHref\("collection", collection\.id\)\}/);
  assert.match(store, /aria-label=\{`Inspecionar coleção \$\{collection\.name\}`\}/);
  assert.doesNotMatch(store, /selectedCollectionId/);
  assert.doesNotMatch(store, /collectionModalOpen/);
});

test("PROFILE V4 territory surface routes purchasable skins and never invents a price", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /storefront\.territorySkins\.map/);
  assert.match(store, /skin\.status/);
  assert.match(store, /showcaseHref\("offer",\s*offer\.id,\s*skin\.id\)/);
  assert.match(store, /EM BREVE|ANUNCIADO/);
  assert.doesNotMatch(store, /skin\.price/);
});

test("PROFILE V4 treasury renders DB credit packs but keeps BRL checkout disabled", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /id="reforcar-tesouraria"/);
  assert.match(store, /storefront\.creditPacks\.map/);
  assert.match(store, /EM BREVE/);
  assert.match(store, /disabled/);
  assert.doesNotMatch(store, /Stripe|MercadoPago|checkout/i);
});

test("PROFILE V4 store keeps implementation jargon out of player-facing copy", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.doesNotMatch(store, />[^<]*(?:Economy V2|backend|autoridade comercial)[^<]*</i);
});

test("PROFILE V4 store delegates inspection state to the dedicated showcase route", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /function showcaseHref/);
  assert.match(store, /\/profile\/store\/showcase\//);
  assert.doesNotMatch(store, /InspectionContent/);
  assert.doesNotMatch(store, /inspectionOpen/);
  assert.doesNotMatch(store, /profile-store-mobile-inspection\.module\.css/);
});
