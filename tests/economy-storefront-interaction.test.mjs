import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

const contract = source("src/lib/economy/economy-contract.ts");
const service = source("src/lib/server/economy/economy-service.ts");
const migration = source("src/lib/db/migrations/managed/038-economy-cosmetics-foundation.sql");
const arsenal = source("src/components/profile/v4/profile-arsenal.tsx");
const store = source("src/components/profile/v4/profile-store.tsx");
const storePage = source("src/app/profile/store/page.tsx");

test("storefront privado projeta inventário próprio para o Arsenal V4", () => {
  assert.match(contract, /ownedItems: ReadonlyArray<CosmeticCatalogItem>/);
  assert.match(service, /ownedItems: ownedRows\.map\(cosmeticFromRow\)/);
  assert.match(arsenal, /storefront\.ownedItems\.filter/);
  assert.match(arsenal, /Cosméticos possuídos/);
  assert.match(arsenal, /LOADOUT_SLOTS\.map/);

  for (const id of [
    "dice.attack.default",
    "dice.defense.default",
    "dice.neutral.default",
    "territory.effect.default",
  ]) {
    assert.match(migration, new RegExp(id.replaceAll(".", "\\.")));
  }
  assert.match(migration, /'available', TRUE/);
});

test("equipagem V4 fica isolada no Arsenal e usa somente a boundary de loadout", () => {
  assert.match(arsenal, /item\.status !== "available"/);
  assert.match(arsenal, /storefront\.loadout\[item\.slot\]\.id === item\.id/);
  assert.match(arsenal, /\/api\/economy\/loadout/);
  assert.match(arsenal, /EQUIPANDO…/);
  assert.match(arsenal, /ARQUIVADO · POSSUÍDO/);
  assert.doesNotMatch(arsenal, /\/api\/economy\/purchases/);
  assert.doesNotMatch(arsenal, /\/api\/economy\/(reward|grant)/i);
});

test("Intendência V4 separa descoberta, inspeção e compra do fluxo de equipagem", () => {
  assert.match(store, /function showcaseHref/);
  assert.match(store, /\/profile\/store\/showcase\//);
  assert.match(store, /purchaseShowcaseOffer/);
  assert.match(store, /storefront\.collections/);
  assert.match(store, /storefront\.offers/);
  assert.doesNotMatch(store, /\/api\/economy\/loadout/);
  assert.doesNotMatch(store, /previewSetId|previewItemId|data-preview-detail/);
});

test("acesso direto à loja não quebra sessão autenticada sem comandante", () => {
  assert.match(storePage, /if \(!session\) redirect\("\/"\)/);
  assert.match(storePage, /error instanceof EconomyServiceError/);
  assert.match(storePage, /error\.code === "ECONOMY_COMMANDER_MISSING"/);
  assert.match(storePage, /redirect\("\/profile"\)/);
});
