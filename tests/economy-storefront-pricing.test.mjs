import assert from "node:assert/strict";
import test from "node:test";
import {
  quoteStorefrontProduct,
  resolveProgressiveUnitPrice,
} from "../.test-build/economy/storefront-pricing.js";

const fixed = (cosmeticId, owned, price = 500) => ({
  cosmeticId,
  owned,
  pricing: { type: "fixed", price },
});

const vikingDice = (ownedIds = []) => [
  fixed("viking-attack", ownedIds.includes("viking-attack")),
  fixed("viking-defense", ownedIds.includes("viking-defense")),
  fixed("viking-neutral", ownedIds.includes("viking-neutral")),
];

test("STORE-05: bundle cobra apenas cosméticos ausentes e aplica desconto ao subtotal restante", () => {
  const noneOwned = quoteStorefrontProduct(vikingDice(), 2000);
  assert.deepEqual(noneOwned.missingCosmeticIds, [
    "viking-attack",
    "viking-defense",
    "viking-neutral",
  ]);
  assert.equal(noneOwned.subtotal, 1500);
  assert.equal(noneOwned.finalPrice, 1200);
  assert.equal(noneOwned.fullyOwned, false);

  const oneOwned = quoteStorefrontProduct(vikingDice(["viking-attack"]), 2000);
  assert.deepEqual(oneOwned.missingCosmeticIds, ["viking-defense", "viking-neutral"]);
  assert.equal(oneOwned.subtotal, 1000);
  assert.equal(oneOwned.finalPrice, 800);

  const twoOwned = quoteStorefrontProduct(
    vikingDice(["viking-attack", "viking-defense"]),
    2000,
  );
  assert.deepEqual(twoOwned.missingCosmeticIds, ["viking-neutral"]);
  assert.equal(twoOwned.subtotal, 500);
  assert.equal(twoOwned.finalPrice, 400);

  const allOwned = quoteStorefrontProduct(
    vikingDice(["viking-attack", "viking-defense", "viking-neutral"]),
    2000,
  );
  assert.deepEqual(allOwned.missingCosmeticIds, []);
  assert.equal(allOwned.subtotal, 0);
  assert.equal(allOwned.finalPrice, 0);
  assert.equal(allOwned.fullyOwned, true);
});

test("STORE-09: desconto usa floor determinístico e aritmética inteira", () => {
  const quote = quoteStorefrontProduct([fixed("odd-price", false, 999)], 3333);
  assert.equal(quote.subtotal, 999);
  assert.equal(quote.finalPrice, 666);

  const noDiscount = quoteStorefrontProduct([fixed("full-price", false, 999)], 0);
  assert.equal(noDiscount.finalPrice, 999);

  const maximumDiscount = quoteStorefrontProduct([fixed("free-at-max", false, 999)], 10000);
  assert.equal(maximumDiscount.finalPrice, 0);
});

test("STORE-09: discount_bps fora de 0..10000 é rejeitado", () => {
  assert.throws(() => quoteStorefrontProduct(vikingDice(), -1), /discount_bps/i);
  assert.throws(() => quoteStorefrontProduct(vikingDice(), 10001), /discount_bps/i);
});

test("STORE-10: preço progressivo seleciona tiers explícitos nas fronteiras", () => {
  const tiers = [
    { acquisitionsFrom: 0, acquisitionsUntil: 99, price: 500 },
    { acquisitionsFrom: 100, acquisitionsUntil: 249, price: 575 },
    { acquisitionsFrom: 250, acquisitionsUntil: 499, price: 675 },
    { acquisitionsFrom: 500, acquisitionsUntil: 999, price: 775 },
    { acquisitionsFrom: 1000, acquisitionsUntil: null, price: 900 },
  ];

  assert.equal(resolveProgressiveUnitPrice(0, tiers), 500);
  assert.equal(resolveProgressiveUnitPrice(99, tiers), 500);
  assert.equal(resolveProgressiveUnitPrice(100, tiers), 575);
  assert.equal(resolveProgressiveUnitPrice(249, tiers), 575);
  assert.equal(resolveProgressiveUnitPrice(250, tiers), 675);
  assert.equal(resolveProgressiveUnitPrice(999, tiers), 775);
  assert.equal(resolveProgressiveUnitPrice(1000, tiers), 900);
  assert.equal(resolveProgressiveUnitPrice(100000, tiers), 900);
});

test("STORE-10: tiers sobrepostos e faixa sem preço são rejeitados", () => {
  assert.throws(
    () =>
      resolveProgressiveUnitPrice(100, [
        { acquisitionsFrom: 0, acquisitionsUntil: 100, price: 500 },
        { acquisitionsFrom: 100, acquisitionsUntil: null, price: 575 },
      ]),
    /overlap|sobrepos/i,
  );

  assert.throws(
    () =>
      resolveProgressiveUnitPrice(100, [
        { acquisitionsFrom: 0, acquisitionsUntil: 99, price: 500 },
        { acquisitionsFrom: 101, acquisitionsUntil: null, price: 575 },
      ]),
    /price tier|tier/i,
  );
});

test("STORE-10: bundle pode misturar preço fixo e progressivo", () => {
  const quote = quoteStorefrontProduct(
    [
      fixed("fixed", false, 500),
      {
        cosmeticId: "progressive",
        owned: false,
        pricing: {
          type: "progressive",
          acquisitionCount: 100,
          tiers: [
            { acquisitionsFrom: 0, acquisitionsUntil: 99, price: 500 },
            { acquisitionsFrom: 100, acquisitionsUntil: null, price: 575 },
          ],
        },
      },
    ],
    2000,
  );

  assert.equal(quote.subtotal, 1075);
  assert.equal(quote.finalPrice, 860);
  assert.deepEqual(quote.missingCosmeticIds, ["fixed", "progressive"]);
});
