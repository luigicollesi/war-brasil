import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

const migration = source("src/lib/db/migrations/managed/038-economy-cosmetics-foundation.sql");
const gameMigration = source("src/lib/db/migrations/managed/039-game-cosmetic-loadout-snapshots.sql");
const contract = source("src/lib/economy/economy-contract.ts");
const gameContract = source("src/lib/shared/game-contract.ts");
const repository = source("src/lib/server/economy/economy-repository.ts");
const service = source("src/lib/server/economy/economy-service.ts");
const gameCosmetics = source("src/lib/server/game-cosmetic-loadout-service.ts");
const startGame = source("src/lib/server/start-game-service.ts");
const gameSnapshot = source("src/lib/server/game-snapshot-service.ts");
const gameFinish = source("src/lib/server/game-finish-command-service.ts");
const snapshotSharing = source("src/lib/shared/game-snapshot-sharing.ts");
const storefrontRoute = source("src/app/api/economy/storefront/route.ts");
const loadoutRoute = source("src/app/api/economy/loadout/route.ts");
const storePage = source("src/app/profile/store/page.tsx");
const storeUi = source("src/components/profile/store/economy-storefront.tsx");

test("histórico de migrations preserva 037 do Profile e move economia para 038", () => {
  assert.equal(
    existsSync("src/lib/db/migrations/managed/037-profile-remove-portraits.sql"),
    true,
  );
  assert.equal(
    existsSync("src/lib/db/migrations/managed/037-economy-cosmetics-foundation.sql"),
    false,
  );
  assert.equal(
    existsSync("src/lib/db/migrations/managed/038-economy-cosmetics-foundation.sql"),
    true,
  );
  assert.equal(
    existsSync("src/lib/db/migrations/managed/039-game-cosmetic-loadout-snapshots.sql"),
    true,
  );
});

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

test("economia serializa inicialização, storefront, equipagem e captura da partida pelo comandante", () => {
  assert.match(repository, /export async function lockCommanderEconomyState/);
  assert.match(
    repository,
    /FROM profile\.commanders[\s\S]*WHERE user_id=\$1::uuid[\s\S]*FOR UPDATE/,
  );

  assert.match(
    service,
    /getEconomyStorefront[\s\S]*client\.query\("BEGIN"\)[\s\S]*ensureLockedEconomyState\(userId, client\)[\s\S]*findCampaignCreditWallet\(userId, client\)[\s\S]*client\.query\("COMMIT"\)/,
  );
  assert.match(
    service,
    /equipCosmetic[\s\S]*client\.query\("BEGIN"\)[\s\S]*ensureLockedEconomyState\(userId, client\)[\s\S]*findOwnedCosmetic\(userId, cosmeticId, client\)[\s\S]*equipOwnedCosmetic\(userId, slot, cosmeticId, client\)[\s\S]*client\.query\("COMMIT"\)/,
  );

  assert.match(gameCosmetics, /lockRoomCommanderCosmeticStates/);
  assert.match(
    gameCosmetics,
    /ORDER BY commander\.user_id[\s\S]*FOR UPDATE OF commander/,
  );
  assert.match(
    gameCosmetics,
    /capturePlayerCosmeticLoadouts[\s\S]*await lockRoomCommanderCosmeticStates\(client, roomId\)[\s\S]*INSERT INTO game\.player_cosmetic_loadouts/,
  );
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

test("partida congela loadout em game.* e snapshot não lê Profile em runtime", () => {
  assert.match(gameMigration, /CREATE TABLE IF NOT EXISTS game\.player_cosmetic_loadouts/);
  assert.match(gameMigration, /asset_ref TEXT/);
  assert.match(gameMigration, /effect_key TEXT/);
  assert.match(gameMigration, /catalog_cosmetics_default_slot_uidx/);
  assert.match(startGame, /capturePlayerCosmeticLoadouts\(client, roomId\)/);
  assert.match(gameCosmetics, /INSERT INTO game\.player_cosmetic_loadouts/);
  assert.match(gameCosmetics, /loadRoomPlayerCosmetics/);

  const runtimeReader = gameCosmetics.slice(
    gameCosmetics.indexOf("export async function loadRoomPlayerCosmetics"),
  );
  assert.match(runtimeReader, /FROM game\.player_cosmetic_loadouts snapshot/);
  assert.doesNotMatch(runtimeReader, /profile\.|inventory\.|catalog\./);

  assert.match(gameSnapshot, /loadRoomPlayerCosmetics\(client, room\.id\)/);
  assert.match(gameSnapshot, /cosmetics,/);
  assert.match(gameContract, /export type GamePlayerCosmetics/);
  assert.match(gameContract, /cosmetics: GamePlayerCosmetics/);
});

test("waiting completa snapshot parcial com defaults efêmeros, mas partida ativa exige persistência completa", () => {
  assert.match(gameCosmetics, /function waitingPlayerCosmetics/);
  assert.match(gameCosmetics, /bySlot\.dice_attack[\s\S]*defaults\.diceAttack/);
  assert.match(gameCosmetics, /bySlot\.dice_defense[\s\S]*defaults\.diceDefense/);
  assert.match(gameCosmetics, /bySlot\.dice_neutral[\s\S]*defaults\.diceNeutral/);
  assert.match(gameCosmetics, /bySlot\.territory_effect[\s\S]*defaults\.territoryEffect/);
  assert.match(
    gameCosmetics,
    /player\.room_status === "waiting"[\s\S]*waitingPlayerCosmetics\(playerRows\)/,
  );
  assert.match(gameCosmetics, /requirePlayerCosmetics\(player\.id, playerRows\)/);

  const runtimeReader = gameCosmetics.slice(
    gameCosmetics.indexOf("export async function loadRoomPlayerCosmetics"),
  );
  assert.doesNotMatch(runtimeReader, /profile\.|inventory\.|catalog\./);
  assert.match(runtimeReader, /room\.status AS room_status/);
});

test("GameSnapshot expõe somente cosméticos necessários, sem economia ou identidade auth", () => {
  assert.match(gameContract, /cosmeticId: string/);
  assert.match(gameContract, /assetRef: string \| null/);
  assert.match(gameContract, /effectKey: string \| null/);
  assert.doesNotMatch(gameContract, /campaign-credit|wallet|ledger|inventory|userId|authUser/i);
  assert.doesNotMatch(gameSnapshot, /economy\.wallets|economy\.ledger_entries|inventory\.cosmetics/);
  assert.doesNotMatch(
    gameSnapshot,
    /SELECT[^`]*\buser_id\b[^`]*FROM game\.players/,
  );
});

test("rematch descarta snapshot anterior e structural sharing observa cosméticos", () => {
  assert.match(gameFinish, /DELETE FROM game\.player_cosmetic_loadouts/);
  assert.match(snapshotSharing, /samePlayerCosmetics/);
  assert.match(snapshotSharing, /sameCosmeticSelection/);
  assert.match(snapshotSharing, /left\.cosmetics, right\.cosmetics/);
});

test("store autenticada usa cena Profile sem preço ou CTA de compra", () => {
  assert.match(storePage, /auth\.api\.getSession/);
  assert.match(storePage, /getEconomyStorefront\(session\.user\.id\)/);
  assert.match(storeUi, /data-scene="profile"/);
  assert.match(storeUi, /EM BREVE/);
  assert.match(storeUi, /Sem checkout/);
  assert.doesNotMatch(storeUi, /COMPRAR|Comprar agora|price|checkout\(/i);
});

test("listagem não hardcode SVGs HQ e detalhe monta somente o asset selecionado", () => {
  assert.doesNotMatch(storeUi, /\/dados\//);
  assert.match(storeUi, />D6</);
  assert.match(storeUi, /previewOpen/);
  assert.match(storeUi, /selectedPreviewItem\?\.assetRef/);
  assert.match(storeUi, /src=\{selectedPreviewItem\.assetRef\}/);
  assert.match(storeUi, /loading="lazy"/);
  assert.match(storeUi, /unoptimized/);
});
