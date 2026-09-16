import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(
  "src/lib/server/economy/economy-service.ts",
  "utf8",
);
const repository = readFileSync(
  "src/lib/server/economy/economy-repository.ts",
  "utf8",
);
const storefrontRepository = readFileSync(
  "src/lib/server/economy/economy-storefront-repository.ts",
  "utf8",
);
const storefront = readFileSync(
  "src/components/profile/v4/profile-store.tsx",
  "utf8",
);
const purchaseStart = service.indexOf("export async function purchaseOffer");
const purchaseEnd = service.indexOf("export async function equipCosmetic");
const purchaseSource = service.slice(purchaseStart, purchaseEnd);

test("offer indisponível é rejeitada antes de qualquer débito", () => {
  const statusGuard = purchaseSource.indexOf("if (!offer.available_now)");
  const debit = purchaseSource.indexOf("debitCampaignCreditWallet(userId, price, client)");
  assert.ok(statusGuard >= 0);
  assert.ok(debit > statusGuard);
  assert.match(purchaseSource, /ECONOMY_OFFER_UNAVAILABLE/);
});

test("offer totalmente possuída é rejeitada antes de receipt, ledger e débito", () => {
  const fullyOwnedGuard = purchaseSource.indexOf(
    "if (quote.fullyOwned || missingRows.length === 0)",
  );
  const receipt = purchaseSource.indexOf("createPurchaseReceipt(");
  const debit = purchaseSource.indexOf("debitCampaignCreditWallet(userId, price, client)");
  const ledger = purchaseSource.indexOf(
    "insertPurchaseLedgerEntry(userId, purchaseId, price, client)",
  );

  assert.ok(fullyOwnedGuard >= 0);
  assert.ok(receipt > fullyOwnedGuard);
  assert.ok(debit > fullyOwnedGuard);
  assert.ok(ledger > fullyOwnedGuard);
  assert.match(purchaseSource, /ECONOMY_OFFER_ALREADY_OWNED/);
});

test("receipt persiste preço pago e retry resolve receipt antes da offer atual", () => {
  assert.match(repository, /price_paid::text AS price_paid/);
  assert.match(repository, /INSERT INTO economy\.purchases\([\s\S]*price_paid/);
  assert.match(purchaseSource, /findPurchaseReceiptByIdempotencyKey/);
  assert.ok(
    purchaseSource.indexOf("findPurchaseReceiptByIdempotencyKey(") <
      purchaseSource.indexOf("lockOfferProductForPurchase(offerId, client)"),
  );
});

test("item available sem offer ativa não cria caminho de compra por inferência", () => {
  assert.match(storefrontRepository, /FROM catalog\.offers offer/);
  assert.match(storefrontRepository, /JOIN catalog\.product_items membership/);
  assert.match(storefrontRepository, /WHERE offer\.status='available'/);
  assert.match(storefront, /storefront\.offers/);
  assert.doesNotMatch(storefront, /storefront\.sets\.map[\s\S]{0,400}purchase\(/);
});

test("frontend envia apenas identidade, idempotência e expectedPrice para purchase", () => {
  assert.match(
    storefront,
    /body:\s*JSON\.stringify\(\{\s*offerId:\s*offer\.id,\s*idempotencyKey,\s*expectedPrice:\s*offer\.price,\s*\}\)/,
  );
  assert.doesNotMatch(storefront, /JSON\.stringify\(\{[^}]*cosmeticIds/);
  assert.doesNotMatch(storefront, /JSON\.stringify\(\{[^}]*balance/);
  assert.doesNotMatch(storefront, /JSON\.stringify\(\{[^}]*currency/);
});
