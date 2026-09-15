import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const contract = readFileSync("src/lib/economy/economy-contract.ts", "utf8");
const repository = readFileSync(
  "src/lib/server/economy/economy-storefront-repository.ts",
  "utf8",
);
const service = readFileSync("src/lib/server/economy/economy-service.ts", "utf8");
const store = readFileSync("src/components/profile/v4/profile-store.tsx", "utf8");

test("STORE-15/17: offer contract exposes authoritative timed availability metadata", () => {
  assert.match(contract, /startsAt:\s*string\s*\|\s*null/);
  assert.match(contract, /endsAt:\s*string\s*\|\s*null/);
  assert.match(repository, /offer\.starts_at/);
  assert.match(repository, /offer\.ends_at/);
  assert.match(service, /startsAt:\s*row\.starts_at/);
  assert.match(service, /endsAt:\s*row\.ends_at/);
  assert.match(store, /Disponível até/);
  assert.match(store, /Pode retornar à rotação futuramente/);
});

test("STORE-16/20: snapshot exposes active campaigns independently from collections", () => {
  assert.match(contract, /export type StorefrontCampaign/);
  assert.match(contract, /campaigns:\s*ReadonlyArray<StorefrontCampaign>/);
  assert.match(repository, /catalog\.campaigns/);
  assert.match(repository, /catalog\.campaign_offers/);
  assert.match(service, /listStorefrontCampaigns/);
  assert.match(service, /campaigns:/);
  assert.match(store, /storefront\.campaigns/);
});

test("STORE-16: campaign read model never becomes owned inventory", () => {
  assert.doesNotMatch(contract, /StorefrontCampaign[\s\S]{0,600}\bowned\s*:/);
  assert.doesNotMatch(repository, /catalog\.campaigns[\s\S]{0,1000}inventory\.cosmetics/);
});

test("STORE-20/23: territory skins reuse active single offers when commercially available", () => {
  assert.match(store, /territoryOfferByCosmeticId/);
  assert.match(store, /item\.slot === "territory_skin"/);
  assert.match(store, /purchase\(offer\)/);
  assert.match(store, /EM BREVE/);
});
