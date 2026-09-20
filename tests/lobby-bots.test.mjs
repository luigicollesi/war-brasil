import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "src/lib/db/migrations/011-bot-players.sql",
  "utf8",
);
const schema = readFileSync("src/lib/db/schema.sql", "utf8");
const rooms = readFileSync("src/lib/server/rooms.ts", "utf8");
const startGame = readFileSync("src/lib/server/start-game-service.ts", "utf8");
const lobby = readFileSync("src/lib/shared/lobby.ts", "utf8");
const gameContract = readFileSync("src/lib/shared/game-contract.ts", "utf8");
const gameSnapshot = readFileSync(
  "src/lib/server/game-snapshot-service.ts",
  "utf8",
);
const gameCosmeticLoadout = readFileSync(
  "src/lib/server/game-cosmetic-loadout-service.ts",
  "utf8",
);
const lobbyClient = readFileSync("src/components/lobby-client.tsx", "utf8");
const lobbyFormation = readFileSync(
  "src/components/lobby-formation-panel.tsx",
  "utf8",
);

test("schema e migration identificam bots e versionam o catálogo de facções", () => {
  for (const source of [migration, schema]) {
    assert.match(source, /is_bot BOOLEAN NOT NULL DEFAULT FALSE/);
    assert.match(source, /UNIQUE \(color, name\)/);
    assert.match(source, /ON CONFLICT \(color, name\) DO NOTHING/);
  }
  assert.match(migration, /CREATE TABLE IF NOT EXISTS bot_names/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS catalog\.bot_names/);

  const seededNames =
    migration.match(/\('(forest|ocean|sun|ruby|violet|orange)', '[^']+'\)/g) ?? [];
  assert.equal(seededNames.length, 24);
});

test("gerenciamento de bots permanece serializado pelo lock da sala", () => {
  assert.match(rooms, /async function findRoomForUpdate/);
  assert.match(rooms, /FOR UPDATE/);

  const addBot = rooms.slice(
    rooms.indexOf("export async function addBotToRoom"),
    rooms.indexOf("export async function removeBotFromRoom"),
  );
  const removeBot = rooms.slice(
    rooms.indexOf("export async function removeBotFromRoom"),
    rooms.indexOf("export async function getLobbySnapshot"),
  );

  assert.match(addBot, /findRoomForUpdate\(client, code\)/);
  assert.match(removeBot, /findRoomForUpdate\(client, code\)/);
  assert.match(addBot, /assertRoomManager/);
  assert.match(removeBot, /assertRoomManager/);
});

test("bot recebe identidade interna, cor livre, nome catalogado e prontidão automática", () => {
  assert.match(rooms, /const colors = await availableColors/);
  assert.match(rooms, /colors\[randomInt\(0, colors\.length\)\]/);
  assert.match(rooms, /randomBotName\(client, color\)/);
  assert.match(rooms, /const botSession = randomUUID\(\)/);
  assert.match(rooms, /VALUES \(\$1, \$2, \$3, \$4, TRUE, TRUE\)/);
  assert.match(rooms, /resetHumanReadiness\(client, room\.id\)/);
});

test("somente o primeiro humano da sala pode gerenciar bots", () => {
  assert.match(rooms, /WHERE room_id = \$1 AND is_bot = FALSE/);
  assert.match(rooms, /ORDER BY joined_at ASC, id ASC/);
  assert.match(rooms, /Apenas o criador da sala pode gerenciar bots/);
});

test("remoção de bot nunca pode apagar um jogador humano", () => {
  const removeBot = rooms.slice(
    rooms.indexOf("export async function removeBotFromRoom"),
    rooms.indexOf("export async function getLobbySnapshot"),
  );

  assert.match(removeBot, /DELETE FROM game\.players/);
  assert.match(removeBot, /AND is_bot = TRUE/);
});

test("contratos do lobby e do jogo expõem isBot sem criar entidade paralela", () => {
  assert.match(lobby, /isBot: boolean/);
  assert.match(lobby, /canManageBots: boolean/);
  assert.match(gameContract, /export type GamePlayer = \{[\s\S]*?isBot: boolean/);
  assert.match(gameSnapshot, /is_bot/);
  assert.match(gameSnapshot, /isBot: player\.is_bot/);
});

test("inicialização continua incluindo todos os jogadores da sala", () => {
  assert.match(
    startGame,
    /SELECT id FROM game\.players WHERE room_id\s*=\s*\$1 ORDER BY joined_at,id/,
  );
  assert.doesNotMatch(startGame, /is_bot\s*=\s*FALSE/);
});

test("rotas de lobby delegam criação e remoção ao domínio", () => {
  const addRoute = readFileSync(
    "src/app/api/rooms/[code]/bots/route.ts",
    "utf8",
  );
  const removeRoute = readFileSync(
    "src/app/api/rooms/[code]/bots/[botId]/route.ts",
    "utf8",
  );

  assert.match(addRoute, /export async function POST/);
  assert.match(addRoute, /addBotToRoom/);
  assert.match(removeRoute, /export async function DELETE/);
  assert.match(removeRoute, /removeBotFromRoom/);
});

test("lobby oferece controles de bot somente quando o servidor autoriza", () => {
  assert.match(lobbyClient, /canManageBots=\{canManageBots\}/);
  assert.match(lobbyClient, /onAddBot=\{\(\) => void addBot\(\)\}/);
  assert.match(lobbyClient, /onRemoveBot=\{removeBot\}/);
  assert.match(lobbyClient, /\/bots/);
  assert.match(lobbyClient, /method: "DELETE"/);
  assert.match(lobbyFormation, /\+ Bot/);
  assert.match(lobbyFormation, /player\.isBot && canManageBots/);
});

test("lobby mostra adicionar bot somente na primeira vaga vazia", () => {
  assert.match(lobbyFormation, /emptySlots\.map\(\(_, index\) =>/);
  assert.match(lobbyFormation, /canManageBots && index === 0/);
  assert.match(lobbyFormation, /aria-label="Adicionar bot na próxima vaga"/);
});

test("migration da fase 1 permanece independente do scheduler da fase 2", () => {
  const automationMigration = readFileSync(
    "src/lib/db/migrations/012-bot-automation.sql",
    "utf8",
  );

  assert.doesNotMatch(migration, /bot_next_action_at/);
  assert.match(automationMigration, /bot_next_action_at/);
});


test("bots recebem quatro cosméticos aleatórios disponíveis no snapshot de início", () => {
  assert.match(gameCosmeticLoadout, /player\.is_bot/);
  assert.match(
    gameCosmeticLoadout,
    /slot IN \('dice_attack','dice_defense','dice_neutral','territory_skin'\)/,
  );
  assert.match(gameCosmeticLoadout, /LEFT JOIN LATERAL/);
  assert.match(gameCosmeticLoadout, /candidate\.status='available'/);
  assert.match(gameCosmeticLoadout, /candidate\.slot=player_slot\.slot/);
  assert.match(gameCosmeticLoadout, /ORDER BY random\(\)/);
  assert.match(gameCosmeticLoadout, /LIMIT 1/);
  assert.match(gameCosmeticLoadout, /player_slot\.is_bot=FALSE/);
  assert.match(
    gameCosmeticLoadout,
    /WHEN player_slot\.is_bot AND bot_cosmetic\.id IS NOT NULL THEN bot_cosmetic\.asset_ref/,
  );
});
