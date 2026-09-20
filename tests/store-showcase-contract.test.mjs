import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const projectionPath = "src/lib/economy/store-showcase.ts";
const routePath = "src/app/profile/store/showcase/[kind]/[id]/page.tsx";

function read(path) {
  return readFileSync(path, "utf8");
}

test("store showcase contract resolves offer and collection targets without client pricing math", () => {
  const projection = read(projectionPath);
  const route = read(routePath);

  assert.match(projection, /export type StoreShowcaseKind = "offer" \| "collection"/);
  assert.match(projection, /export type StoreShowcaseView/);
  assert.match(projection, /export function resolveStoreShowcaseView/);
  assert.match(projection, /kind === "offer"/);
  assert.match(projection, /kind === "collection"/);
  assert.match(projection, /selectedItemId/);
  assert.match(projection, /bundleOffer/);
  assert.match(projection, /singleOfferByItemId/);
  assert.match(projection, /item\.slot === "territory_skin"/);
  assert.doesNotMatch(projection, /0\.8|0\.6|promotionDiscountBps\s*\/|price\s*\*/);

  assert.match(route, /getEconomyStorefront/);
  assert.match(route, /resolveStoreShowcaseView/);
  assert.match(route, /notFound\(\)/);
  assert.match(route, /StoreShowcase/);
});

test("store showcase contract keeps authoritative offer prices, availability and safe selected-item fallback", () => {
  const projection = read(projectionPath);

  assert.match(projection, /price:\s*offer\.price/);
  assert.match(projection, /basePrice:\s*offer\.basePrice/);
  assert.match(projection, /promotionDiscountBps:\s*offer\.promotionDiscountBps/);
  assert.match(projection, /startsAt:\s*offer\.startsAt/);
  assert.match(projection, /endsAt:\s*offer\.endsAt/);
  assert.match(projection, /items\.find\(.*selectedItemId/s);
  assert.match(projection, /\?\?\s*items\[0\]/);
});