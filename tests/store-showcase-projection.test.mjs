import assert from "node:assert/strict";
import test from "node:test";
import { projectStoreShowcase } from "../.test-build/economy/store-showcase.js";

function cosmetic(id, slot, { owned = false, equipped = false } = {}) {
  return {
    id,
    slug: id,
    name: id,
    description: `${id} description`,
    slot,
    rarity: null,
    status: "available",
    isDefault: false,
    owned,
    equipped,
    previewRef: `/assets/${id}.webp`,
    assetRef: `cosmetics/${id}.webp`,
    effectKey: null,
  };
}

function offer(id, items, price, overrides = {}) {
  const ownedCount = items.filter((item) => item.owned).length;
  return {
    id,
    slug: id,
    name: id,
    description: `${id} offer`,
    currency: "campaign-credit",
    basePrice: price,
    promotionDiscountBps: 0,
    price,
    status: "available",
    featured: false,
    startsAt: null,
    endsAt: null,
    items,
    ownedCount,
    totalCount: items.length,
    fullyOwned: ownedCount === items.length,
    partiallyOwned: ownedCount > 0 && ownedCount < items.length,
    purchasable: ownedCount < items.length,
    ...overrides,
  };
}

const attack = cosmetic("dice.attack.simple", "dice_attack");
const defense = cosmetic("dice.defense.simple", "dice_defense");
const neutral = cosmetic("dice.neutral.simple", "dice_neutral");
const territory = cosmetic("territory.azulejo", "territory_skin");
const footballAttack = cosmetic("dice.attack.football", "dice_attack");
const footballDefense = cosmetic("dice.defense.football", "dice_defense", { owned: true });
const footballTerritory = cosmetic("territory.football", "territory_skin");

const simpleAttack = offer("offer.simple.attack", [attack], 150);
const simpleDefense = offer("offer.simple.defense", [defense], 150);
const simpleNeutral = offer("offer.simple.neutral", [neutral], 150);
const simpleBundle = offer("offer.simple.bundle", [attack, defense, neutral], 400);
const territoryOffer = offer("offer.territory.azulejo", [territory], 300);

const footballAttackOffer = offer("offer.football.attack", [footballAttack], 300, {
  basePrice: 500,
  promotionDiscountBps: 4000,
});
const footballDefenseOffer = offer("offer.football.defense", [footballDefense], 0, {
  basePrice: 0,
  promotionDiscountBps: 4000,
  purchasable: false,
  fullyOwned: true,
  ownedCount: 1,
});
const footballTerritoryOffer = offer("offer.football.territory", [footballTerritory], 300, {
  basePrice: 500,
  promotionDiscountBps: 4000,
});
const footballBundle = offer(
  "offer.football.bundle",
  [footballAttack, footballDefense, footballTerritory],
  480,
  {
    basePrice: 800,
    promotionDiscountBps: 4000,
    ownedCount: 1,
    partiallyOwned: true,
  },
);

const snapshot = {
  wallet: {
    currency: "campaign-credit",
    label: "Créditos de Campanha",
    shortLabel: "CRÉDITOS",
    symbol: "◈",
    balance: 2500,
  },
  loadout: {},
  ownedItems: [footballDefense],
  sets: [],
  campaigns: [],
  territorySkins: [territory],
  creditPacks: [],
  offers: [
    simpleAttack,
    simpleDefense,
    simpleNeutral,
    simpleBundle,
    territoryOffer,
    footballAttackOffer,
    footballDefenseOffer,
    footballTerritoryOffer,
    footballBundle,
  ],
  collections: [
    {
      id: "collection.football",
      slug: "football",
      name: "Futebol",
      description: "Coleção Futebol",
      featured: true,
      promotionDiscountBps: 4000,
      assets: {
        banner: "/assets/football-banner.webp",
        background: "/assets/football-background.webp",
        logo: "/assets/football-logo.webp",
      },
      items: [footballAttack, footballDefense, footballTerritory],
      offerIds: [
        footballAttackOffer.id,
        footballDefenseOffer.id,
        footballTerritoryOffer.id,
        footballBundle.id,
      ],
      singleOfferIds: [
        footballAttackOffer.id,
        footballDefenseOffer.id,
        footballTerritoryOffer.id,
      ],
      bundleOfferIds: [footballBundle.id],
      ownedCount: 1,
      totalCount: 3,
      fullyOwned: false,
      partiallyOwned: true,
    },
  ],
};

test("normal multi-item offer resolves canonical single offers without recomputing prices", () => {
  const result = projectStoreShowcase(snapshot, "offer", simpleBundle.id);

  assert.ok(result);
  assert.equal(result.mode, "standard");
  assert.equal(result.bundleOffer, simpleBundle);
  assert.deepEqual(
    result.items.map((entry) => entry.individualOffer?.id),
    [simpleAttack.id, simpleDefense.id, simpleNeutral.id],
  );
  assert.deepEqual(
    result.items.map((entry) => entry.individualOffer?.price),
    [150, 150, 150],
  );
  assert.equal(result.selectedItemId, attack.id);
  assert.equal(result.background, null);
  assert.equal(result.logo, null);
});

test("single territory offer uses itself as the individual purchase and has no bundle CTA", () => {
  const result = projectStoreShowcase(snapshot, "offer", territoryOffer.id);

  assert.ok(result);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].cosmetic.slot, "territory_skin");
  assert.equal(result.items[0].individualOffer, territoryOffer);
  assert.equal(result.bundleOffer, null);
});

test("collection projection uses declared singles, bundle, background and authoritative promotion prices", () => {
  const result = projectStoreShowcase(
    snapshot,
    "collection",
    "collection.football",
    footballTerritory.id,
  );

  assert.ok(result);
  assert.equal(result.mode, "collection");
  assert.equal(result.background, "/assets/football-background.webp");
  assert.equal(result.logo, "/assets/football-logo.webp");
  assert.equal(result.promotionDiscountBps, 4000);
  assert.equal(result.bundleOffer, footballBundle);
  assert.equal(result.bundleOffer.price, 480);
  assert.equal(result.bundleOffer.basePrice, 800);
  assert.equal(result.selectedItemId, footballTerritory.id);
  assert.deepEqual(result.items.map((entry) => entry.cosmetic.slot), [
    "dice_attack",
    "dice_defense",
    "territory_skin",
  ]);
  assert.deepEqual(result.items.map((entry) => entry.individualOffer?.id), [
    footballAttackOffer.id,
    footballDefenseOffer.id,
    footballTerritoryOffer.id,
  ]);
});

test("invalid selected item falls back to the first showcase item", () => {
  const result = projectStoreShowcase(
    snapshot,
    "collection",
    "collection.football",
    "cosmetic.not-in-collection",
  );

  assert.ok(result);
  assert.equal(result.selectedItemId, footballAttack.id);
});

test("unknown target kind or id fails closed", () => {
  assert.equal(projectStoreShowcase(snapshot, "offer", "offer.missing"), null);
  assert.equal(projectStoreShowcase(snapshot, "collection", "collection.missing"), null);
  assert.equal(projectStoreShowcase(snapshot, "unsupported", simpleBundle.id), null);
});
