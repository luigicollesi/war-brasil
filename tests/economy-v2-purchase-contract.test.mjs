import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const migrationPath = "src/lib/db/migrations/managed/041-economy-v2-commerce.sql";
const migration = source(migrationPath);
const contract = source("src/lib/economy/economy-contract.ts");
const repository = source("src/lib/server/economy/economy-repository.ts");
const service = source("src/lib/server/economy/economy-service.ts");
const purchaseRoutePath = "src/app/api/economy/purchases/route.ts";
const purchaseRoute = source(purchaseRoutePath);

test("economy v2 cria migration comercial incremental", () => {
  assert.equal(existsSync(migrationPath), true);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.offers/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.offer_items/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS economy\.purchases/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.credit_packs/);
});

test("offer persiste preço inteiro positivo em campaign-credit e composição individual", () => {
  assert.match(migration, /currency_code TEXT NOT NULL/);
  assert.match(migration, /price BIGINT NOT NULL/);
  assert.match(migration, /CHECK \(price > 0\)/);
  assert.match(migration, /REFERENCES economy\.currencies\(code\)/);
  assert.match(migration, /REFERENCES catalog\.cosmetics\(id\)/);
  assert.match(migration, /'campaign-credit'/);
});

test("receipt é idempotente por usuário e preserva preço histórico", () => {
  assert.match(migration, /price_paid BIGINT NOT NULL/);
  assert.match(migration, /idempotency_key TEXT NOT NULL/);
  assert.match(
    migration,
    /UNIQUE\s*\(user_id,\s*idempotency_key\)|CREATE UNIQUE INDEX[\s\S]*user_id[\s\S]*idempotency_key/i,
  );
});

test("STORE-12: contrato público recebe expectedPrice sem aceitar autoridade econômica do browser", () => {
  assert.match(contract, /export type PurchaseOfferInput/);
  assert.match(contract, /offerId: string/);
  assert.match(contract, /idempotencyKey: string/);
  assert.match(contract, /expectedPrice: number/);
  const purchaseInput = contract.slice(contract.indexOf("export type PurchaseOfferInput"));
  assert.doesNotMatch(
    purchaseInput.slice(0, purchaseInput.indexOf("}>;") + 3),
    /userId|currency|balance|cosmeticIds/,
  );
});

test("purchase é transacional, trava wallet e grava receipt + ledger + ownership", () => {
  assert.match(repository, /export async function lockCampaignCreditWallet/);
  assert.match(repository, /FOR UPDATE/);
  assert.match(repository, /export async function findPurchasableOffer/);
  assert.match(repository, /export async function createPurchaseReceipt/);
  assert.match(repository, /export async function debitCampaignCreditWallet/);
  assert.match(repository, /INSERT INTO economy\.ledger_entries/);
  assert.match(repository, /INSERT INTO inventory\.cosmetics/);

  assert.match(service, /export async function purchaseOffer/);
  assert.match(service, /client\.query\("BEGIN"\)/);
  assert.match(service, /client\.query\("COMMIT"\)/);
  assert.match(service, /client\.query\("ROLLBACK"\)/);
  assert.match(service, /lockCampaignCreditWallet/);
});

test("STORE-12: servidor recalcula preço e rejeita confirmação stale antes de debitar", () => {
  assert.match(service, /expectedPrice/);
  assert.match(service, /ECONOMY_PRICE_CHANGED/);
  assert.match(service, /409/);
  const priceCheck = service.indexOf("ECONOMY_PRICE_CHANGED");
  const debit = service.indexOf("debitCampaignCreditWallet");
  assert.ok(priceCheck >= 0, "price-change gate must exist");
  assert.ok(debit > priceCheck, "price confirmation must happen before wallet debit");
});

test("POST purchases deriva ator da sessão e aceita offerId + idempotencyKey + expectedPrice", () => {
  assert.equal(existsSync(purchaseRoutePath), true);
  assert.match(purchaseRoute, /getAuthenticatedSession\(request\)/);
  assert.match(purchaseRoute, /rejectUntrustedMutationOrigin\(request\)/);
  assert.match(purchaseRoute, /purchaseOffer\(session\.user\.id/);
  assert.match(purchaseRoute, /input\.expectedPrice/);
  assert.doesNotMatch(purchaseRoute, /payload\.userId|body\.userId|input\.userId/);
  assert.doesNotMatch(purchaseRoute, /payload\.balance|payload\.currency|payload\.cosmeticIds/);
});

test("packs BRL permanecem catálogo demonstrativo sem checkout", () => {
  assert.match(migration, /price_brl_cents BIGINT NOT NULL/);
  assert.match(migration, /credit_amount BIGINT NOT NULL/);
  assert.match(migration, /'announced'/);
  assert.equal(existsSync("src/app/api/economy/checkout/route.ts"), false);
  assert.equal(existsSync("src/app/api/economy/credit-packs/purchase/route.ts"), false);
});
