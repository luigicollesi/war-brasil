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

test("PROFILE V4 store consumes catalog data instead of hardcoding commercial authority", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /storefront\.sets/);
  assert.doesNotMatch(store, /R\$\s*\d/);
  assert.doesNotMatch(store, /price:\s*\d/);
  assert.doesNotMatch(store, /userId/);
});

test("PROFILE V4 store exposes the future treasury reinforcement anchor without enabling checkout", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /id="reforcar-tesouraria"/);
  assert.match(store, /EM BREVE/);
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