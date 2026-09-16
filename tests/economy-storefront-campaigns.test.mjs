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
const showcaseProjection = readFileSync("src/lib/economy/store-showcase.ts", "utf8");

test("STORE-15/17: offer contract and showcase expose authoritative timed availability metadata", () => {
  assert.match(contract, /startsAt:\s*string\s*\|\s*null/);
  assert.match(contract, /endsAt:\s*string\s*\|\s*null/);
  assert.match(repository, /offer\.starts_at/);
  assert.match(repository, /offer\.ends_at/);
  assert.match(service, /startsAt:\s*row\.starts_at/);
  assert.match(service, /endsAt:\s*row\.ends_at/);
  assert.match(showcaseProjection, /startsAt:\s*offer\.startsAt/);
  assert.match(showcaseProjection, /endsAt:\s*offer\.endsAt/);
});

test("STORE-15: expired offer continues to fail closed at the authoritative purchase boundary", () => {
  const purchaseStart = service.indexOf("export async function purchaseOffer");
  const purchaseEnd = service.indexOf("export async function equipCosmetic");
  const purchaseSource = service.slice(purchaseStart, purchaseEnd);

  assert.match(purchaseSource, /if \(!offer\.available_now\)/);
  assert.match(purchaseSource, /ECONOMY_OFFER_UNAVAILABLE/);
  assert.ok(
    purchaseSource.indexOf("ECONOMY_OFFER_UNAVAILABLE") <
      purchaseSource.indexOf("debitCampaignCreditWallet"),
  );
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

test("STORE-20/23: territory skins reuse active single offers and route them to showcase", () => {
  assert.match(store, /territoryOfferByCosmeticId/);
  assert.match(store, /item\.slot === "territory_skin"/);
  assert.match(store, /showcaseHref\("offer",\s*offer\.id,\s*skin\.id\)/);
  assert.match(store, /EM BREVE/);
});