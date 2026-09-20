import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("PROFILE V4 discovery opens showcase while retained direct purchase confirms authoritative price", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /function showcaseHref/);
  assert.match(store, /INSPECIONAR/);
  assert.match(store, /purchaseShowcaseOffer/);
  assert.match(store, /pendingOfferId/);
  assert.match(store, /expectedPrice:\s*offer\.price/);
  assert.doesNotMatch(store, /fetch\([^)]*\/api\/economy\/purchases/);
});

test("purchase API remains session-derived and accepts only the authoritative purchase contract", async () => {
  const route = await source("src/app/api/economy/purchases/route.ts");

  assert.match(route, /getAuthenticatedSession\(request\)/);
  assert.match(route, /parsePurchaseOfferInput\(payload\)/);
  assert.match(route, /session\.user\.id/);
  assert.match(route, /input\.offerId/);
  assert.match(route, /input\.idempotencyKey/);
  assert.match(route, /input\.expectedPrice/);
  assert.doesNotMatch(route, /payload\.userId/);
  assert.doesNotMatch(route, /payload\.cosmeticIds/);
});

test("showcase projection carries server-derived prices instead of creating client pricing math", async () => {
  const projection = await source("src/lib/economy/store-showcase.ts");

  assert.match(projection, /price:\s*offer\.price/);
  assert.match(projection, /basePrice:\s*offer\.basePrice/);
  assert.match(projection, /promotionDiscountBps:\s*offer\.promotionDiscountBps/);
  assert.doesNotMatch(projection, /Math\.(?:floor|round)\([^\n]*price/);
});
