import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

const migration = source("src/lib/db/migrations/managed/037-economy-cosmetics-foundation.sql");
const contract = source("src/lib/economy/economy-contract.ts");
const repository = source("src/lib/server/economy/economy-repository.ts");
const service = source("src/lib/server/economy/economy-service.ts");
const storefrontRoute = source("src/app/api/economy/storefront/route.ts");
const loadoutRoute = source("src/app/api/economy/loadout/route.ts");
const storePage = source("src/app/profile/store/page.tsx");
const storeUi = source("src/components/profile/store/economy-storefront.tsx");

test("economia v1 possui uma única moeda real com saldo inteiro não negativo", () => {
  assert.match(migration, /VALUES \('campaign-credit', 'Créditos de Campanha', '◈', TRUE\)/);
  assert.match(migration, /balance BIGINT NOT NULL DEFAULT 0/);
  assert.match(migration, /CHECK \(balance >= 0\)/);
  assert.match(contract, /ECONOMY_CURRENCY_ID = "campaign-credit"/);
  assert.doesNotMatch(migration, /command-reserve|Reserva de Comando|moeda premium/i);
  assert.doesNotMatch(contract, /command-reserve/);
});

test("catálogo inicial contém quatro defaults e três conjuntos anunciados", () => {
  for (const id of [
    "dice.attack.default",
    "dice.defense.default",
    "dice.neutral.default",
    "territory.effect.default",
  ]) {
    assert.match(migration, new RegExp(id.replaceAll(".", "\\.")));
  }

  for (const set of ["set.exercito", "set.lancas", "set.viking"]) {
    assert.match(migration, new RegExp(set.replaceAll(".", "\\.")));
  }

  for (const path of [
    "/dados/exercito/ataque.svg",
    "/dados/exercito/defesa.svg",
    "/dados/exercito/neutro.svg",
    "/dados/lancas/ataque.svg",
    "/dados/lancas/defesa.svg",
    "/dados/lancas/neutro.svg",
    "/dados/viking/ataque.svg",
    "/dados/viking/defesa.svg",
    "/dados/viking/neutro.svg",
  ]) {
    assert.match(migration, new RegExp(path.replaceAll("/", "\\/")));
  }

  assert.match(migration, /'announced', FALSE/);
});

test("loadout possui exatamente quatro slots e DB exige ownership compatível", () => {
  for (const slot of ["dice_attack", "dice_defense", "dice_neutral", "territory_effect"]) {
    assert.match(contract, new RegExp(`"${slot}"`));
    assert.match(migration, new RegExp(`'${slot}'`));
  }

  assert.match(migration, /FOREIGN KEY \(cosmetic_id, slot\)[\s\S]*REFERENCES catalog\.cosmetics\(id, slot\)/);
  assert.match(migration, /FOREIGN KEY \(user_id, slot, cosmetic_id\)[\s\S]*REFERENCES inventory\.cosmetics\(user_id, slot, cosmetic_id\)/);
  assert.match(service, /item\.slot !== slot/);
  assert.match(service, /item\.status !== "available"/);
});

test("inicialização econômica é idempotente e não cria movimentação", () => {
  assert.match(repository, /INSERT INTO economy\.wallets[\s\S]*ON CONFLICT \(user_id, currency_code\) DO NOTHING/);
  assert.match(repository, /INSERT INTO inventory\.cosmetics[\s\S]*ON CONFLICT \(user_id, cosmetic_id\) DO NOTHING/);
  assert.match(repository, /INSERT INTO profile\.cosmetic_loadout[\s\S]*ON CONFLICT \(user_id, slot\) DO NOTHING/);
  assert.doesNotMatch(repository, /INSERT INTO economy\.ledger_entries/);
  assert.doesNotMatch(service, /ledger_entries|UPDATE economy\.wallets|SET balance/i);
});

test("APIs derivam ator da sessão e expõem somente leitura + equipagem", () => {
  assert.match(storefrontRoute, /getAuthenticatedSession\(request\)/);
  assert.match(storefrontRoute, /getEconomyStorefront\(session\.user\.id\)/);
  assert.match(loadoutRoute, /getAuthenticatedSession\(request\)/);
  assert.match(loadoutRoute, /rejectUntrustedMutationOrigin\(request\)/);
  assert.match(loadoutRoute, /equipCosmetic\(session\.user\.id/);
  assert.doesNotMatch(storefrontRoute + loadoutRoute, /payload\.userId|body\.userId|input\.userId/);

  for (const forbidden of ["purchase", "reward", "transfer", "grant", "checkout"]) {
    assert.equal(existsSync(`src/app/api/economy/${forbidden}/route.ts`), false);
  }
});

test("store autenticada usa cena Profile sem preço ou CTA de compra", () => {
  assert.match(storePage, /auth\.api\.getSession/);
  assert.match(storePage, /getEconomyStorefront\(session\.user\.id\)/);
  assert.match(storeUi, /data-scene="profile"/);
  assert.match(storeUi, /EM BREVE/);
  assert.match(storeUi, /Sem checkout/);
  assert.doesNotMatch(storeUi, /COMPRAR|Comprar agora|price|checkout\(/i);
});

test("listagem da loja não referencia nem renderiza os SVGs HQ diretamente", () => {
  assert.doesNotMatch(storeUi, /\/dados\//);
  assert.doesNotMatch(storeUi, /assetRef|<img|<Image/);
  assert.match(storeUi, />D6</);
});
