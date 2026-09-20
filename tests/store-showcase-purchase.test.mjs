import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const PURCHASE_PATH = "src/lib/client/store-showcase/purchase-showcase-offer.ts";
const SHOWCASE_PATH = "src/components/profile/v4/store-showcase/store-showcase.tsx";

const read = (path) => readFileSync(path, "utf8");

test("showcase purchases use the existing authoritative economy endpoint and exact request contract", () => {
  assert.equal(existsSync(PURCHASE_PATH), true, "showcase purchase client must exist");
  const purchase = read(PURCHASE_PATH);

  assert.match(purchase, /fetch\(["']\/api\/economy\/purchases["']/);
  assert.match(purchase, /method:\s*["']POST["']/);
  assert.match(purchase, /offerId/);
  assert.match(purchase, /idempotencyKey/);
  assert.match(purchase, /expectedPrice/);
  assert.match(purchase, /JSON\.stringify\(\{\s*offerId,\s*idempotencyKey,\s*expectedPrice,?\s*\}\)/s);

  assert.doesNotMatch(purchase, /JSON\.stringify\([^)]*balance/s);
  assert.doesNotMatch(purchase, /JSON\.stringify\([^)]*currency/s);
  assert.doesNotMatch(purchase, /JSON\.stringify\([^)]*promotionDiscountBps/s);
  assert.doesNotMatch(purchase, /JSON\.stringify\([^)]*cosmeticId/s);
});

test("showcase purchase retries preserve idempotency for uncertain failures", () => {
  const purchase = read(PURCHASE_PATH);

  assert.match(purchase, /crypto\.randomUUID\(\)/);
  assert.match(purchase, /attemptsByQuote/);
  assert.match(purchase, /offerId.*expectedPrice|expectedPrice.*offerId/s);
  assert.match(purchase, /response\.ok/);
  assert.match(purchase, /response\.status\s*>=\s*500/);
  assert.match(purchase, /attemptsByQuote\.delete/);
});

test("item and bundle CTAs share the purchase path and refresh authoritative server projection", () => {
  const showcase = read(SHOWCASE_PATH);

  assert.match(showcase, /useRouter/);
  assert.match(showcase, /purchaseShowcaseOffer/);
  assert.match(showcase, /handlePurchase\(selectedOffer\)/);
  assert.match(showcase, /handlePurchase\(showcase\.bundleOffer\)/);
  assert.match(showcase, /router\.refresh\(\)/);
  assert.match(showcase, /selectedItemId/);
  assert.doesNotMatch(showcase, /setWallet|setBalance|setOwned/);
});

test("purchase state handles active price changes and failures without client-side authority", () => {
  const showcase = read(SHOWCASE_PATH);

  assert.match(showcase, /ECONOMY_PRICE_CHANGED/);
  assert.match(showcase, /purchaseMessage/);
  assert.match(showcase, /aria-live=["']polite["']/);
  assert.match(showcase, /pendingOfferId/);
  assert.match(showcase, /purchasable/);
});
