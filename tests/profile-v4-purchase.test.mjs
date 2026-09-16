import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

function purchaseSource(store) {
  const start = store.indexOf("async function purchase(");
  const end = store.indexOf("\n  return (", start);
  assert.ok(start >= 0, "purchase handler must exist");
  assert.ok(end > start, "purchase handler must end before component render");
  return store.slice(start, end);
}

test("PROFILE V4 purchase sends offer identity, idempotency and confirmed expectedPrice", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /fetch\("\/api\/economy\/purchases"/);
  assert.match(store, /method:\s*"POST"/);
  assert.match(store, /crypto\.randomUUID\(\)/);
  assert.match(
    store,
    /body:\s*JSON\.stringify\(\{[\s\S]*offerId:\s*offer\.id,[\s\S]*idempotencyKey,[\s\S]*expectedPrice:\s*offer\.price[\s\S]*\}\)/,
  );
  assert.doesNotMatch(store, /userId\s*:/);
  assert.doesNotMatch(store, /cosmeticIds\s*:/);
});

test("PROFILE V4 purchase rejects stale confirmation and requires a new user action", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const purchase = purchaseSource(store);
  const priceChangedStart = purchase.indexOf('payload?.error === "ECONOMY_PRICE_CHANGED"');
  const unavailableStart = purchase.indexOf(
    'payload?.error === "ECONOMY_OFFER_UNAVAILABLE"',
    priceChangedStart,
  );

  assert.ok(priceChangedStart >= 0, "price-change branch must exist");
  assert.ok(unavailableStart > priceChangedStart, "price-change branch must be bounded");
  const priceChangedBranch = purchase.slice(priceChangedStart, unavailableStart);

  assert.match(priceChangedBranch, /currentPrice/);
  assert.match(priceChangedBranch, /router\.refresh\(\)/);
  assert.match(priceChangedBranch, /Confirme novamente|confirme novamente/i);
  assert.match(priceChangedBranch, /return;/);
  assert.doesNotMatch(priceChangedBranch, /purchase\(offer\)/);
});

test("PROFILE V4 purchase interaction prevents duplicate clicks and refreshes authoritative state", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /pendingOfferId/);
  assert.match(store, /if \(pendingOfferId\) return/);
  assert.match(store, /router\.refresh\(\)/);
  assert.match(store, /response\.ok/);
  assert.match(store, /ECONOMY_INSUFFICIENT_BALANCE/);
});

test("PROFILE V4 purchase feedback keeps campaign credits visually canonical", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");

  assert.match(store, /purchaseFeedback/);
  assert.match(store, /\/coin\.svg/);
});
