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
const storefront = readFileSync(
  "src/components/profile/store/economy-storefront.tsx",
  "utf8",
);

test("storefront V2 expõe offers, composição, ownership derivado e credit packs", () => {
  assert.match(contract, /export type EconomyOffer =/);
  assert.match(contract, /ownedCount: number/);
  assert.match(contract, /totalCount: number/);
  assert.match(contract, /fullyOwned: boolean/);
  assert.match(contract, /partiallyOwned: boolean/);
  assert.match(contract, /export type EconomyCreditPack =/);
  assert.match(contract, /creditAmount: number/);
  assert.match(contract, /priceBrlCents: number/);
  assert.match(
    contract,
    /EconomyStorefrontSnapshot[\s\S]*offers: ReadonlyArray<EconomyOffer>[\s\S]*creditPacks: ReadonlyArray<EconomyCreditPack>/,
  );
});

test("storefront V2 deriva catálogo comercial no servidor sem regra React hardcoded", () => {
  assert.match(repository, /export async function listStorefrontOffers/);
  assert.match(repository, /catalog\.offers/);
  assert.match(repository, /catalog\.offer_items/);
  assert.match(repository, /export async function listStorefrontCreditPacks/);
  assert.match(repository, /catalog\.credit_packs/);

  assert.match(service, /listStorefrontOffers/);
  assert.match(service, /listStorefrontCreditPacks/);
  assert.match(service, /offers:/);
  assert.match(service, /creditPacks:/);

  assert.doesNotMatch(storefront, /offer\.(exercito|lancas|viking|gato|cachorro|futebol)/);
  assert.doesNotMatch(storefront, /price\s*[:=]\s*400/);
});

test("Intendência V2 compra offer por id + idempotency key e reconcilia resposta autoritativa", () => {
  assert.match(storefront, /storefront\.offers\.map/);
  assert.match(storefront, /\/api\/economy\/purchases/);
  assert.match(storefront, /crypto\.randomUUID\(\)/);
  assert.match(storefront, /offerId/);
  assert.match(storefront, /idempotencyKey/);
  assert.match(storefront, /payload\.wallet/);
  assert.match(storefront, /payload\.offer/);
  assert.match(storefront, /COMPRAR/);
  assert.match(storefront, /POSSUÍDO/);
  assert.match(storefront, /EQUIPADO/);
  assert.doesNotMatch(storefront, /nenhuma compra ou recompensa está ativa/i);
});

test("offer não comprável é apresentada como indisponível e não como CTA de compra", () => {
  assert.match(storefront, /!offer\.purchasable[\s\S]*"INDISPONÍVEL"/);
  assert.match(storefront, /insufficientBalance/);
  assert.match(storefront, /Saldo insuficiente para esta oferta/);
});

test("campanha usa coin.svg como identidade primária e packs BRL permanecem desabilitados", () => {
  assert.match(storefront, /src="\/coin\.svg"/);
  assert.doesNotMatch(storefront, /storefront\.wallet\.symbol/);
  assert.match(storefront, /storefront\.creditPacks\.map/);
  assert.match(storefront, /priceBrlCents/);
  assert.match(storefront, /EM BREVE/);
  assert.match(storefront, /disabled/);
  assert.doesNotMatch(storefront, /stripe|mercado\s*pago|checkout/i);
});
