import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "src/lib/db/migrations/011-bot-players.sql",
  "utf8",
);
const schema = readFileSync("src/lib/db/schema.sql", "utf8");
const rooms = readFileSync("src/lib/server/rooms.ts", "utf8");
const lobby = readFileSync("src/lib/shared/lobby.ts", "utf8");
const gameContract = readFileSync("src/lib/shared/game-contract.ts", "utf8");
const gameSnapshot = readFileSync(
  "src/lib/server/game-snapshot-service.ts",
  "utf8",
);
const lobbyClient = readFileSync("src/components/lobby-client.tsx", "utf8");

test("schema e migration identificam bots e versionam o catálogo de facções", () => {
  for (const source of [migration, schema]) {
    assert.match(source, /is_bot BOOLEAN NOT NULL DEFAULT FALSE/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS bot_names/);
    assert.match(source, /UNIQUE \(color, name\)/);
    assert.match(source, /ON CONFLICT \(color, name\) DO NOTHING/);
  }

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
  assert.match(addBot, /assertRoomBotManager/);
  assert.match(removeBot, /assertRoomBotManager/);
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

  assert.match(removeBot, /DELETE FROM room_players/);
  assert.match(removeBot, /AND is_bot = TRUE/);
});

test("contratos do lobby e do jogo expõem isBot sem criar entidade paralela", () => {
  assert.match(lobby, /isBot: boolean/);
  assert.match(lobby, /canManageBots: boolean/);
  assert.match(gameContract, /export type GamePlayer = \{[\s\S]*?isBot: boolean/);
  assert.match(gameSnapshot, /is_bot/);
  assert.match(gameSnapshot, /isBot: player\.is_bot/);
});

test("inicialização continua incluindo todos os room_players", () => {
  const initializeGame = rooms.slice(
    rooms.indexOf("async function initializeGame"),
    rooms.indexOf("export async function createRoom"),
  );

  assert.match(
    initializeGame,
    /SELECT id FROM room_players WHERE room_id = \$1 ORDER BY joined_at/,
  );
  assert.doesNotMatch(initializeGame, /is_bot\s*=\s*FALSE/);
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
  assert.match(lobbyClient, /canManageBots/);
  assert.match(lobbyClient, /\+ Bot/);
  assert.match(lobbyClient, /player\.isBot && canManageBots/);
  assert.match(lobbyClient, /\/bots/);
  assert.match(lobbyClient, /method: "DELETE"/);
});

test("lobby mostra adicionar bot somente na primeira vaga vazia", () => {
  assert.match(lobbyClient, /emptySlots\.map\(\(_, index\) =>/);
  assert.match(lobbyClient, /canManageBots && index === 0/);
  assert.match(lobbyClient, /aria-label="Adicionar bot na próxima vaga"/);
});

test("migration da fase 1 permanece independente do scheduler da fase 2", () => {
  const automationMigration = readFileSync(
    "src/lib/db/migrations/012-bot-automation.sql",
    "utf8",
  );

  assert.doesNotMatch(migration, /bot_next_action_at/);
  assert.match(automationMigration, /bot_next_action_at/);
});
