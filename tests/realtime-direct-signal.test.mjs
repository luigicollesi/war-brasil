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

test("publisher exige confirmação de entrega direta quando URL interna está configurada", () => {
  const publisher = source("src/lib/server/game-realtime-publisher.ts");

  assert.match(publisher, /\/internal\/ephemeral/);
  assert.match(publisher, /Authorization: `Bearer \$\{token\}`/);
  assert.match(publisher, /body\.delivered < 1/);
  assert.match(publisher, /Nenhum cliente conectado recebeu a sinalização realtime/);
  assert.match(publisher, /const delivered = await publishEphemeralDirect\(event\)/);
  assert.match(publisher, /if \(delivered !== null\) return true/);
  assert.match(publisher, /await publishGameRealtimeBusEvent\(client, event\)/);
});

test("gateway valida e transmite evento efêmero interno retornando quantidade entregue", () => {
  const server = source("realtime/server.mjs");
  const registry = source("realtime/registry.mjs");

  assert.match(server, /request\.url === "\/internal\/ephemeral"/);
  assert.match(server, /parseNotificationPayload/);
  assert.match(server, /request\.headers\.authorization !== `Bearer \$\{internalToken\}`/);
  assert.match(server, /const delivered = registry\.broadcastEphemeral\(event\)/);
  assert.match(server, /writeJson\(response, 200, \{ delivered \}\)/);
  assert.match(registry, /let delivered = 0/);
  assert.match(registry, /delivered \+= 1/);
  assert.match(registry, /return delivered/);
});
