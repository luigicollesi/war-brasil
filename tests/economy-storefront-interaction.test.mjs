import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

const contract = source("src/lib/economy/economy-contract.ts");
const service = source("src/lib/server/economy/economy-service.ts");
const migration = source("src/lib/db/migrations/managed/038-economy-cosmetics-foundation.sql");
const store = source("src/components/profile/store/economy-storefront.tsx");

test("storefront privado projeta inventário próprio necessário para reequipagem", () => {
  assert.match(contract, /ownedItems: ReadonlyArray<CosmeticCatalogItem>/);
  assert.match(service, /ownedItems: ownedRows\.map\(cosmeticFromRow\)/);
  assert.match(store, /storefront\.ownedItems\.map/);
  assert.match(store, />Arsenal possuído</);
  assert.match(store, /Os quatro padrões permanecem disponíveis/);

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

test("item possuído available pode ser reequipado sem qualquer caminho de aquisição", () => {
  assert.match(store, /const canEquip = item\.status === "available" && !equipped/);
  assert.match(store, /onClick=\{\(\) => equip\(item\)\}/);
  assert.match(store, /EQUIPANDO…/);
  assert.match(store, /ARQUIVADO/);
  assert.doesNotMatch(store, /purchase|checkout|reward|grant|acquire|comprar|preço/i);
});

test("remessa anunciada possui preview interativo leve e sem aquisição", () => {
  assert.match(store, /previewSetId/);
  assert.match(store, /aria-expanded=\{previewOpen\}/);
  assert.match(store, />INSPECIONAR</);
  assert.match(store, /data-preview-detail/);
  assert.match(store, /PRÉVIA DETALHADA/);
  assert.match(store, /HQ SOB DEMANDA · SEM AQUISIÇÃO/);

  // A listagem e a prévia textual não carregam os SVGs multi-megabyte. O asset
  // autoritativo continua no DTO para runtime futuro, mas não é renderizado aqui.
  assert.doesNotMatch(store, /assetRef|previewRef|<img|<Image|\/dados\//);
});
