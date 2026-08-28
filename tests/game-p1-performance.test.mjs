import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("manobra reutiliza topologia base cacheada através do serviço efetivo sem consultar tabela por jogada", () => {
  const route = readFileSync(
    "src/app/api/games/[roomId]/maneuver/route.ts",
    "utf8",
  );
  const maneuver = readFileSync(
    "src/lib/game-maneuver-command-service.ts",
    "utf8",
  );
  const effectiveTopology = readFileSync(
    "src/lib/game-effective-topology-service.ts",
    "utf8",
  );
  const topology = readFileSync("src/lib/game-topology-service.ts", "utf8");

  assert.match(route, /game-maneuver-command-service/);
  assert.match(maneuver, /getEffectiveGameTopology/);
  assert.match(maneuver, /topology\.connections/);
  assert.match(maneuver, /jurassic_tunnel_territory_id/);
  assert.match(maneuver, /bestTerritoryRoute/);
  assert.doesNotMatch(maneuver, /getBaseTerritoryConnections/);
  assert.doesNotMatch(maneuver, /FROM territory_connections/);

  assert.match(effectiveTopology, /getBaseTerritoryConnections/);
  assert.match(effectiveTopology, /effectiveGameConnections/);
  assert.match(topology, /cachedTopology/);
  assert.match(topology, /loadingTopology/);
  assert.match(topology, /FROM territory_connections/);
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
