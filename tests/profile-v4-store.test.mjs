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

test("PROFILE V4 store consumes server-derived collections, offers and packs", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /storefront\.collections/);
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

test("PROFILE V4 store uses the canonical campaign-credit coin beside monetary values", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /src="\/coin\.svg"/);
  assert.match(store, /offer\.price/);
  assert.match(store, /pack\.creditAmount/);
  assert.doesNotMatch(store, />\s*◈\s*</);
});

test("PROFILE V4 store exposes ownership-aware completion instead of legacy full-price semantics", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /offer\.fullyOwned/);
  assert.match(store, /offer\.partiallyOwned/);
  assert.match(store, /offer\.ownedCount/);
  assert.match(store, /offer\.totalCount/);
  assert.match(store, /offer\.purchasable/);
  assert.match(store, /COMPLETAR/);
  assert.match(store, /POSSUÍDO/);
  assert.match(store, /COMPRAR/);
  assert.match(store, /INDISPONÍVEL/);
  assert.doesNotMatch(store, /mantém o valor integral/i);
});

test("PROFILE V4 collection detail uses background, logo and canonical cosmetic art without hero dependency", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /collection\.assets\.banner/);
  assert.match(store, /selectedCollection\.assets\.background/);
  assert.match(store, /selectedCollection\.assets\.logo/);
  assert.match(store, /selectedCollection\.items\.map/);
  assert.match(store, /selectedCollection\.ownedCount/);
  assert.match(store, /selectedCollection\.totalCount/);
  assert.match(store, /Completar coleção|COMPLETAR COLEÇÃO/i);
  assert.doesNotMatch(store, /(?:collection|selectedCollection)\.assets\.(?:hero|card)/);
});

test("PROFILE V4 collection banner is an accessible discovery control", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /selectedCollectionId/);
  assert.match(store, /setSelectedCollectionId/);
  assert.match(store, /collection\.assets\.banner/);
  assert.match(store, /type="button"/);
  assert.match(store, /aria-label=\{`Abrir coleção \$\{collection\.name\}`\}/);
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

test("PROFILE V4 store provides an explicit mobile inspection sheet", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const styles = await source("src/components/profile/v4/profile-store-mobile-inspection.module.css");

  assert.match(store, /inspectionOpen/);
  assert.match(store, /role="dialog"/);
  assert.match(store, /aria-modal="true"/);
  assert.match(store, /event\.key === "Escape"/);
  assert.match(store, /Fechar inspeção/);
  assert.match(styles, /\.mobileInspection/);
  assert.match(styles, /position:\s*fixed/);
  assert.match(styles, /@media \(max-width: 820px\)/);
});

test("PROFILE V4 returns focus to the control that opened mobile inspection", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /inspectionReturnFocusRef/);
  assert.match(store, /document\.activeElement/);
  assert.match(store, /closeInspection\s*=\s*useCallback/);
  assert.match(store, /returnTarget\.isConnected/);
  assert.match(store, /returnTarget\.focus\(\)/);
});
