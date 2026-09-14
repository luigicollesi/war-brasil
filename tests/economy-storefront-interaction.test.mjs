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
  assert.doesNotMatch(store, />COMPRAR<|Comprar agora|price\b|\/api\/economy\/(purchase|reward|grant|checkout)/i);
});

test("remessa anunciada possui preview visual HQ sob demanda e sem aquisição", () => {
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

  // O componente não hardcode os nove caminhos HQ. Eles chegam pelo DTO e só
  // viram src quando o detalhe aberto seleciona exatamente um item.
  assert.doesNotMatch(store, /\/dados\//);
});

test("acesso direto à loja não quebra sessão autenticada sem comandante", () => {
  assert.match(storePage, /if \(!session\) redirect\("\/"\)/);
  assert.match(storePage, /error instanceof EconomyServiceError/);
  assert.match(storePage, /error\.code === "ECONOMY_COMMANDER_MISSING"/);
  assert.match(storePage, /redirect\("\/profile"\)/);
});
