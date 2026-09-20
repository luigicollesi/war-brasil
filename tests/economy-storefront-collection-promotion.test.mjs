import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { quoteStorefrontProduct } from "../.test-build/economy/storefront-pricing.js";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

const fixed = (cosmeticId, owned, price = 500) => ({
  cosmeticId,
  owned,
  pricing: { type: "fixed", price },
});

test("collection promotion is applied after the normal product discount", () => {
  const football = [
    fixed("football-attack", false),
    fixed("football-defense", false),
    fixed("football-neutral", false),
  ];

  const bundle = quoteStorefrontProduct(football, 2000, 4000);
  assert.equal(bundle.subtotal, 1500);
  assert.equal(bundle.basePrice, 1200);
  assert.equal(bundle.promotionDiscountBps, 4000);
  assert.equal(bundle.finalPrice, 720);

  const individual = quoteStorefrontProduct([fixed("football-attack", false)], 0, 4000);
  assert.equal(individual.subtotal, 500);
  assert.equal(individual.basePrice, 500);
  assert.equal(individual.finalPrice, 300);
});

test("collection promotion preserves completion pricing before the promotion", () => {
  const football = [
    fixed("football-attack", true),
    fixed("football-defense", false),
    fixed("football-neutral", false),
  ];

  const quote = quoteStorefrontProduct(football, 2000, 4000);
  assert.equal(quote.subtotal, 1000);
  assert.equal(quote.basePrice, 800);
  assert.equal(quote.finalPrice, 480);
  assert.deepEqual(quote.missingCosmeticIds, ["football-defense", "football-neutral"]);
});

test("storefront schema supports exactly one featured collection and snapshots promotion discount", async () => {
  const migration = await source(
    "src/lib/db/migrations/managed/047-economy-storefront-collection-promotions.sql",
  );

  assert.match(migration, /featured\s+BOOLEAN\s+NOT NULL\s+DEFAULT FALSE/i);
  assert.match(migration, /promotion_discount_bps\s+INTEGER\s+NOT NULL\s+DEFAULT 0/i);
  assert.match(migration, /CREATE UNIQUE INDEX[\s\S]*WHERE featured/i);
  assert.match(migration, /promotion_discount_bps=4000/i);
  assert.match(migration, /WHERE id='collection\.football'/i);
  assert.match(migration, /economy\.purchases[\s\S]*promotion_discount_bps/i);
});

test("collection membership stays out of normal dice and territory discovery", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const repository = await source(
    "src/lib/server/economy/economy-storefront-repository.ts",
  );

  assert.match(store, /collectionOfferIds/);
  assert.match(store, /!collectionOfferIds\.has\(offer\.id\)/);
  assert.match(repository, /item\.collection_id\s+IS\s+NULL/i);
});

test("inactive collections are filtered consistently from offer, item, campaign and quote reads", async () => {
  const storefrontRepository = await source(
    "src/lib/server/economy/economy-storefront-repository.ts",
  );
  const quoteRepository = await source(
    "src/lib/server/economy/storefront-quote-repository.ts",
  );

  assert.ok(
    storefrontRepository.match(/product\.collection_id IS NULL OR collection\.active=TRUE/g)?.length >= 3,
  );
  assert.ok(
    quoteRepository.match(/product\.collection_id IS NULL OR collection\.active=TRUE/g)?.length >= 3,
  );
});

test("purchase fails closed if a collection deactivates between availability and promotion locks", async () => {
  const repository = await source(
    "src/lib/server/economy/storefront-quote-repository.ts",
  );

  assert.match(repository, /collection\.active=TRUE[\s\S]*FOR SHARE/i);
  assert.match(repository, /if \(result\.rowCount !== 1\)[\s\S]*throw new Error/i);
});

test("collection banners route into the dedicated showcase with authoritative promotion detail", async () => {
  const store = await source("src/components/profile/v4/profile-store.tsx");
  const projection = await source("src/lib/economy/store-showcase.ts");
  const showcase = await source(
    "src/components/profile/v4/store-showcase/store-showcase.tsx",
  );

  assert.match(store, /showcaseHref\("collection",\s*collection\.id\)/);
  assert.doesNotMatch(store, /collectionModalOpen/);
  assert.doesNotMatch(store, /aria-modal="true"/);
  assert.match(projection, /backgroundRef:\s*collection\.assets\.background/);
  assert.match(projection, /logoRef:\s*collection\.assets\.logo/);
  assert.match(projection, /promotionDiscountBps:\s*collection\.promotionDiscountBps/);
  assert.match(projection, /singleOfferByItemId/);
  assert.match(projection, /bundleOffer/);
  assert.match(showcase, /showcase\.items\.map/);
  assert.match(showcase, /showcase\.bundleOffer/);
});

test("product cards use intrinsic rows so discovery controls cannot overlap the card body", async () => {
  const styles = await source("src/components/profile/v4/profile-store.module.css");

  assert.match(styles, /\.productCard\s*\{[\s\S]*display:\s*grid/i);
  assert.match(styles, /\.productSelect\s*\{[\s\S]*height:\s*auto/i);
  assert.doesNotMatch(styles, /\.productSelect\s*\{[\s\S]{0,220}height:\s*100%/i);
});
