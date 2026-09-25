import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const contract = readFileSync("src/lib/economy/economy-contract.ts", "utf8");
const repository = readFileSync(
  "src/lib/server/economy/economy-storefront-repository.ts",
  "utf8",
);
const service = readFileSync(
  "src/lib/server/economy/economy-service.ts",
  "utf8",
);
const catalogCache = readFileSync(
  "src/lib/server/economy/storefront-catalog-cache.ts",
  "utf8",
);
const storefront = readFileSync(
  "src/components/profile/v4/profile-store.tsx",
  "utf8",
);
const categoryStorefront = readFileSync(
  "src/components/profile/v4/profile-store-category.tsx",
  "utf8",
);
const showcaseProjection = readFileSync(
  "src/lib/economy/store-showcase.ts",
  "utf8",
);

test("storefront V2 expõe collections, territory skins, offers, ownership derivado e credit packs", () => {
  assert.match(contract, /export const COLLECTION_ASSET_ROLES/);
  assert.match(contract, /"banner"/);
  assert.match(contract, /"background"/);
  assert.match(contract, /"logo"/);
  assert.match(contract, /export type StorefrontCollection =/);
  assert.match(contract, /assets: StorefrontCollectionAssets/);
  assert.match(contract, /offerIds: ReadonlyArray<string>/);
  assert.match(contract, /ownedCount: number/);
  assert.match(contract, /totalCount: number/);
  assert.match(contract, /fullyOwned: boolean/);
  assert.match(contract, /partiallyOwned: boolean/);
  assert.match(contract, /export type EconomyCreditPack =/);
  assert.match(
    contract,
    /EconomyStorefrontSnapshot[\s\S]*collections: ReadonlyArray<StorefrontCollection>[\s\S]*territorySkins: ReadonlyArray<CosmeticCatalogItem>[\s\S]*offers: ReadonlyArray<EconomyOffer>[\s\S]*creditPacks: ReadonlyArray<EconomyCreditPack>/,
  );
});

test("storefront V2 deriva collections completas no servidor e o showcase projeta seus assets", () => {
  assert.match(repository, /export async function listStorefrontCollections/);
  assert.match(repository, /catalog\.collections/);
  assert.match(repository, /catalog\.collection_assets/);
  assert.match(repository, /role='banner'/);
  assert.match(repository, /role='background'/);
  assert.match(repository, /role='logo'/);
  assert.match(repository, /COUNT\(\*\)=3/);

  assert.match(service, /listStorefrontCollections/);
  assert.match(service, /collectionsFromRows/);
  assert.match(service, /collections:/);

  assert.match(storefront, /storefront\.collections/);
  assert.match(storefront, /collection\.assets\.banner/);
  assert.match(showcaseProjection, /backgroundRef:\s*collection\.assets\.background/);
  assert.match(showcaseProjection, /logoRef:\s*collection\.assets\.logo/);
  assert.doesNotMatch(storefront, /store\/collections\/football/);
});

test("storefront V2 expõe skins anunciadas/disponíveis sem convertê-las em ofertas fictícias", () => {
  assert.match(repository, /export async function listStorefrontTerritorySkins/);
  assert.match(repository, /item\.slot='territory_skin'/);
  assert.match(repository, /item\.status IN \('announced','available'\)/);
  assert.match(service, /listStorefrontTerritorySkins/);
  assert.match(service, /territorySkins:/);
  assert.match(categoryStorefront, /territorySkins\.map/);
  assert.match(categoryStorefront, /offer \? \(/);
  assert.match(categoryStorefront, /ANUNCIADO/);
});

test("storefront V2 deriva catálogo comercial no servidor sem regra React hardcoded", () => {
  assert.match(repository, /export async function listStorefrontOffers/);
  assert.match(repository, /catalog\.offers/);
  assert.match(repository, /catalog\.product_items/);
  assert.match(repository, /export async function listStorefrontCreditPacks/);
  assert.match(repository, /catalog\.credit_packs/);

  assert.match(catalogCache, /listStorefrontOffers/);
  assert.match(service, /listActiveStorefrontQuoteItems/);
  assert.match(service, /quoteStorefrontProduct/);
  assert.match(catalogCache, /listStorefrontCreditPacks/);
  assert.match(service, /\boffers,\s*creditPacks:/);
  assert.match(service, /creditPacks:/);

  assert.doesNotMatch(storefront, /offer\.(exercito|lancas|viking|gato|cachorro|futebol)/);
  assert.doesNotMatch(storefront, /price\s*[:=]\s*400/);
});

test("Intendência V4 routes inspection to showcase and keeps retained direct purchase authoritative", () => {
  assert.match(categoryStorefront, /showcase\/offer/);
  assert.match(storefront, /INSPECIONAR/);
  assert.match(categoryStorefront, /purchaseShowcaseOffer/);
  assert.match(categoryStorefront, /expectedPrice:\s*offer\.price/);
  assert.doesNotMatch(categoryStorefront, /fetch\([^)]*\/api\/economy\/purchases/);

  assert.match(showcaseProjection, /price:\s*offer\.price/);
  assert.match(showcaseProjection, /basePrice:\s*offer\.basePrice/);
  assert.match(showcaseProjection, /purchasable:\s*offer\.purchasable/);
});

test("offer não comprável é apresentada como indisponível na descoberta", () => {
  assert.match(storefront, /offer\.purchasable/);
  assert.match(storefront, /INDISPONÍVEL/);
});

test("campanha usa coin.svg como identidade primária e packs BRL permanecem desabilitados", () => {
  assert.match(storefront, /src="\/coin\.svg"/);
  assert.match(storefront, /storefront\.creditPacks\.map/);
  assert.match(storefront, /priceBrlCents/);
  assert.match(storefront, /EM BREVE/);
  assert.match(storefront, /disabled/);
  assert.doesNotMatch(
    storefront,
    /from\s+["']stripe|Stripe\s*\(|MercadoPago|checkoutUrl|paymentIntent|\/api\/payments/i,
  );
});
