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
const storePage = source("src/app/profile/store/page.tsx");

test("storefront privado projeta inventário próprio necessário para reequipagem", () => {
  assert.match(contract, /ownedItems: ReadonlyArray<CosmeticCatalogItem>/);
  assert.match(service, /ownedItems: ownedRows\.map\(cosmeticFromRow\)/);
  assert.match(store, /storefront\.ownedItems\.map/);
  assert.match(store, />Arsenal possuído</);
  assert.match(store, /Cada slot pode ser configurado de forma independente/);

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

test("item possuído available ou retired pode ser reequipado independentemente da aquisição", () => {
  assert.match(
    store,
    /\(item\.status === "available" \|\| item\.status === "retired"\)[\s\S]*!equipped/,
  );
  assert.match(store, /onClick=\{\(\) => equip\(item\)\}/);
  assert.match(store, /EQUIPANDO…/);
  assert.match(store, /POSSUÍDO/);
  assert.match(store, /\/api\/economy\/purchases/);
  assert.doesNotMatch(store, /\/api\/economy\/(reward|grant)/i);
});

test("prévia de coleção permanece HQ sob demanda e não causa aquisição", () => {
  assert.match(store, /previewSetId/);
  assert.match(store, /previewItemId/);
  assert.match(store, /firstPreviewItem/);
  assert.match(store, /aria-expanded=\{previewOpen\}/);
  assert.match(store, /previewOpen \? "FECHAR" : "INSPECIONAR"/);
  assert.match(store, /data-preview-detail/);
  assert.match(store, /data-preview-stage/);
  assert.match(store, /PRÉVIA DETALHADA/);
  assert.match(store, /HQ SOB DEMANDA · SEM AQUISIÇÃO/);
  assert.match(store, /selectedPreviewItem\?\.assetRef/);
  assert.match(store, /src=\{selectedPreviewItem\.assetRef\}/);
  assert.match(store, /<Image/);
  assert.match(store, /loading="lazy"/);
  assert.match(store, /unoptimized/);
  assert.match(store, /aria-pressed=\{selectedPreviewItem\?\.id === item\.id\}/);

  // O componente não hardcode caminhos HQ. Eles chegam pelo DTO e só viram
  // src quando o detalhe aberto seleciona exatamente um item.
  assert.doesNotMatch(store, /\/dados\//);
});

test("acesso direto à loja não quebra sessão autenticada sem comandante", () => {
  assert.match(storePage, /if \(!session\) redirect\("\/"\)/);
  assert.match(storePage, /error instanceof EconomyServiceError/);
  assert.match(storePage, /error\.code === "ECONOMY_COMMANDER_MISSING"/);
  assert.match(storePage, /redirect\("\/profile"\)/);
});
