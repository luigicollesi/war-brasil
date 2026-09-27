import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("ativação Elite exige produto isolado sem descontos e sem coleção", () => {
  const migration = read(
    "src/lib/db/migrations/managed/075-battle-pass-elite-price-integrity.sql",
  );

  assert.match(migration, /pricing\.fixed_price=3000/);
  assert.match(migration, /product\.bundle_discount_bps=0/);
  assert.match(migration, /product\.collection_id IS NULL/);
  assert.match(migration, /COUNT\(\*\)[\s\S]*catalog\.product_entitlements sibling/);
  assert.match(
    migration,
    /isolated undiscounted 3000-credit offer/,
  );
});

test("purchaseOffer rejeita desconto ou entitlement misto antes de cotar Passe", () => {
  const service = read("src/lib/server/economy/economy-service.ts");

  const guardIndex = service.indexOf("const battlePassRows = pricingRows.filter");
  const quoteIndex = service.indexOf(
    "const quote = quoteEntitlements(",
    guardIndex,
  );

  assert.ok(guardIndex >= 0);
  assert.ok(quoteIndex > guardIndex);
  assert.match(service, /item\.entitlement_kind === "battle_pass_access"/);
  assert.match(service, /pricingRows\.length !== 1/);
  assert.match(service, /offer\.bundle_discount_bps !== 0/);
  assert.match(service, /promotionDiscountBps !== 0/);
  assert.match(service, /offer\.collection_id !== null/);
});
