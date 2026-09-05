import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("dev conecta Next ao endpoint interno do gateway para sinais efêmeros", () => {
  const dev = source("scripts/dev.mjs");
  const envExample = source(".env.example");

  assert.match(dev, /GAME_REALTIME_INTERNAL_URL/);
  assert.match(dev, /http:\/\/127\.0\.0\.1:/);
  assert.match(dev, /GAME_REALTIME_INTERNAL_TOKEN/);
  assert.match(dev, /randomUUID/);
  assert.match(envExample, /GAME_REALTIME_INTERNAL_URL/);
  assert.match(envExample, /GAME_REALTIME_INTERNAL_TOKEN/);
});

test("publisher exige entrega direta para todos os jogadores realtime conectados", () => {
  const publisher = source("src/lib/server/game-realtime-publisher.ts");

  assert.match(publisher, /\/internal\/ephemeral/);
  assert.match(publisher, /Authorization: `Bearer \$\{token\}`/);
  assert.match(publisher, /body\.connectedPlayers < 2/);
  assert.match(publisher, /body\.deliveredPlayers !== body\.connectedPlayers/);
  assert.match(publisher, /pelo menos dois jogadores conectados ao realtime/);
  assert.match(publisher, /Nem todos os jogadores conectados receberam/);
  assert.match(publisher, /const delivered = await publishEphemeralDirect\(event\)/);
  assert.match(publisher, /if \(delivered !== null\) return true/);
  assert.match(publisher, /await publishGameRealtimeBusEvent\(client, event\)/);
});

test("gateway retorna confirmação plana por jogador e socket entregue", () => {
  const server = source("realtime/server.mjs");
  const registry = source("realtime/registry.mjs");

  assert.match(server, /request\.url === "\/internal\/ephemeral"/);
  assert.match(server, /parseNotificationPayload/);
  assert.match(server, /request\.headers\.authorization !== `Bearer \$\{internalToken\}`/);
  assert.match(server, /const delivery = registry\.broadcastEphemeral\(event\)/);
  assert.match(server, /writeJson\(response, 200, delivery\)/);
  assert.match(registry, /let delivered = 0/);
  assert.match(registry, /const connectedPlayerIds = new Set\(\)/);
  assert.match(registry, /const deliveredPlayerIds = new Set\(\)/);
  assert.match(registry, /delivered \+= 1/);
  assert.match(registry, /deliveredPlayers: deliveredPlayerIds\.size/);
  assert.match(registry, /connectedPlayers: connectedPlayerIds\.size/);
});
