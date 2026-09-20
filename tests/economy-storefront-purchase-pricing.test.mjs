import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const quoteRepositoryPath =
  "src/lib/server/economy/storefront-quote-repository.ts";
const quoteRepository = source(quoteRepositoryPath);
const service = source("src/lib/server/economy/economy-service.ts");
const entitlementRepository = source(
  "src/lib/server/economy/entitlement-repository.ts",
);
const storefrontRepository = source(
  "src/lib/server/economy/economy-storefront-repository.ts",
);

test("STORE-05/10: storefront lê composição de product_items e pricing por cosmético", () => {
  assert.equal(existsSync(quoteRepositoryPath), true);
  assert.match(quoteRepository, /catalog\.product_items/);
  assert.match(quoteRepository, /catalog\.cosmetic_pricing/);
  assert.match(quoteRepository, /catalog\.cosmetic_stats/);
  assert.match(quoteRepository, /catalog\.price_tiers/);
  assert.match(quoteRepository, /inventory\.cosmetics/);
});

test("STORE-11: compra trava counters dos entitlements antes de calcular tiers", () => {
  assert.match(entitlementRepository, /ORDER BY stats\.cosmetic_id/);
  assert.match(entitlementRepository, /ORDER BY stats\.title_id/);
  assert.match(entitlementRepository, /ORDER BY stats\.background_id/);
  assert.match(entitlementRepository, /FOR UPDATE OF stats/);
  assert.match(service, /lockProductEntitlementStats/);
  assert.match(service, /quoteStorefrontProduct/);
});

test("STORE-13: disponibilidade temporal é filtrada na leitura e validada na compra", () => {
  assert.match(
    storefrontRepository,
    /offer\.active=TRUE[\s\S]*starts_at[\s\S]*CURRENT_TIMESTAMP[\s\S]*ends_at/,
  );
  assert.match(quoteRepository, /starts_at/);
  assert.match(quoteRepository, /ends_at/);
  assert.match(service, /ECONOMY_OFFER_UNAVAILABLE/);
});

test("STORE-12: preview e compra usam o mesmo motor quoteStorefrontProduct", () => {
  const matches = service.match(/quoteStorefrontProduct/g) ?? [];
  assert.ok(matches.length >= 2, "storefront preview and purchase must share quote engine");
  assert.match(service, /ECONOMY_PRICE_CHANGED/);
  assert.match(service, /currentPrice/);
});

test("STORE-10: counters avançam somente para entitlements efetivamente concedidos", () => {
  assert.match(entitlementRepository, /grantEntitlementOwnership/);
  assert.match(entitlementRepository, /incrementEntitlementAcquisitionCount/);
  assert.match(service, /if \(!granted\)/);
  assert.match(service, /incrementEntitlementAcquisitionCount\(entitlement, client\)/);
});
