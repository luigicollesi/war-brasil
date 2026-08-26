import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("manobra reutiliza topologia cacheada sem consultar tabela por jogada", () => {
  const route = readFileSync(
    "src/app/api/games/[roomId]/maneuver/route.ts",
    "utf8",
  );
  const service = readFileSync(
    "src/lib/game-maneuver-command-service.ts",
    "utf8",
  );

  assert.match(route, /game-maneuver-command-service/);
  assert.match(service, /getBaseTerritoryConnections/);
  assert.doesNotMatch(service, /FROM territory_connections/);
  assert.match(service, /jurassicTunnelConnection/);
  assert.match(service, /reachableTerritoryIds/);
});

test("mapa mantém pointermove fora do estado React", () => {
  const source = readFileSync("src/components/interactive-board.tsx", "utf8");

  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /tooltip\.style\.transform/);
  assert.match(source, /pathsByIdRef/);
  assert.match(source, /visualSignatureRef/);
  assert.doesNotMatch(source, /setHovered\(\{details:/);
});

test("sincronização de conexão não cria polling de health no browser", () => {
  const indicator = readFileSync(
    "src/components/server-connection-indicator.tsx",
    "utf8",
  );
  const sync = readFileSync("src/hooks/use-game-sync.ts", "utf8");

  assert.doesNotMatch(indicator, /fetch\(/);
  assert.doesNotMatch(indicator, /\/api\/health/);
  assert.match(indicator, /useSyncExternalStore/);
  assert.match(sync, /gameSyncMetricsStore\.recordSuccess/);
});
