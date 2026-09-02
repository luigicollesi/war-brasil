import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("schema de eventos mantém catálogo, grafo e histórico por rodada separados", () => {
  const migration = readFileSync("src/lib/db/migrations/007-events.sql", "utf8");
  const schema = readFileSync("src/lib/db/schema.sql", "utf8");

  for (const source of [migration, schema]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS events/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS event_connections/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS game_round_events/);
    assert.match(source, /PRIMARY KEY \(room_id, round_number\)/);
    assert.match(source, /to_event <> 0/);
    assert.match(source, /from_event <> to_event/);
    assert.match(source, /weight > 0/);
    assert.match(source, /jsonb_typeof\(resolved_effects\) = 'array'/);
  }
});

test("migration de eventos é não destrutiva e compatível com catálogo já existente", () => {
  const migration = readFileSync("src/lib/db/migrations/007-events.sql", "utf8");

  assert.match(migration, /ADD COLUMN IF NOT EXISTS name TEXT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS description TEXT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS effects JSONB/);
  assert.match(migration, /pg_constraint/);
  assert.match(migration, /event_connections_no_initial_destination_check/);
  assert.match(migration, /event_connections_no_self_loop_check/);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM events|DELETE FROM event_connections/);
});

test("migration de validação reconhece o contrato canônico 38/195 sem exigir seed em banco vazio", () => {
  const migration = readFileSync(
    "src/lib/db/migrations/008-event-catalog-validation.sql",
    "utf8",
  );

  assert.match(migration, /IF event_count = 0 THEN[\s\S]*RETURN/);
  assert.match(migration, /event_count <> 38/);
  assert.match(migration, /connection_count <> 195/);
  assert.match(migration, /from_event = 0\) <> 10/);
  assert.match(migration, /weight <> 1/);
  assert.match(migration, /event_row\.id BETWEEN 1 AND 37/);
  assert.match(migration, /\) <> 5/);
  assert.match(migration, /weight NOT IN \(1, 2, 4\)/);
});

test("repository recebe PoolClient e não abre transações ou pools próprios", () => {
  const source = readFileSync("src/lib/server/events/event-repository.ts", "utf8");

  assert.match(source, /type \{ PoolClient \} from "pg"/);
  assert.doesNotMatch(source, /from ["']@\/src\/lib\/db\/pool["']/);
  assert.doesNotMatch(source, /\bpool\.connect\(/);
  assert.doesNotMatch(source, /BEGIN|COMMIT|ROLLBACK/);
});

test("histórico é lido da tabela de rodadas em ordem decrescente e com janela limitada", () => {
  const source = readFileSync("src/lib/server/events/event-repository.ts", "utf8");

  assert.match(source, /FROM game_round_events/);
  assert.match(source, /ORDER BY round_number DESC/);
  assert.match(source, /LIMIT \$2/);
});

test("seleção mantém aleatoriedade na borda e domínio livre de Math.random", () => {
  const service = readFileSync("src/lib/server/events/event-selection-service.ts", "utf8");
  const selector = readFileSync("src/lib/shared/events/event-selector.ts", "utf8");

  assert.match(service, /randomInt\(totalWeight\)/);
  assert.match(service, /EVENT_HISTORY_SIZE/);
  assert.match(service, /eligibleEventConnections/);
  assert.match(service, /selectWeightedEvent/);
  assert.doesNotMatch(service, /Promise\.all/);
  assert.doesNotMatch(selector, /Math\.random|node:crypto|server-only|PoolClient/);
});

test("resolução mantém crypto na borda e protege a conexão jurássica", () => {
  const service = readFileSync(
    "src/lib/server/events/event-resolution-service.ts",
    "utf8",
  );
  const roundRules = readFileSync("src/lib/shared/game-round-rules.ts", "utf8");
  const resolver = readFileSync("src/lib/shared/events/event-resolver.ts", "utf8");

  assert.match(service, /randomInt\(exclusiveMax\)/);
  assert.match(service, /getBaseTerritoryConnections/);
  assert.match(service, /JURASSIC_TUNNEL_SOURCE_ID/);
  assert.match(roundRules, /JURASSIC_TUNNEL_SOURCE_ID = 3/);
  assert.match(service, /protectedConnections/);
  assert.match(service, /resolveEventEffects/);
  assert.doesNotMatch(resolver, /Math\.random|node:crypto|server-only|PoolClient/);
});

test("contrato estrutural do catálogo é domínio puro e pode validar o banco na borda", () => {
  const catalog = readFileSync("src/lib/shared/events/event-catalog.ts", "utf8");
  const catalogService = readFileSync("src/lib/server/events/event-catalog-service.ts", "utf8");
  const repository = readFileSync("src/lib/server/events/event-repository.ts", "utf8");

  assert.match(catalog, /EVENT_COUNT = EVENT_ID_MAX - EVENT_ID_MIN \+ 1/);
  assert.match(catalog, /EVENT_CONNECTION_COUNT = 195/);
  assert.match(catalog, /INITIAL_EVENT_OUTGOING_COUNT = 10/);
  assert.match(catalog, /STANDARD_EVENT_OUTGOING_COUNT = 5/);
  assert.match(catalogService, /assertEventCatalogShape/);
  assert.match(catalogService, /getEventCatalogSnapshot/);
  assert.match(repository, /SELECT id[\s\S]*FROM events[\s\S]*ORDER BY id/);
  assert.match(repository, /FROM event_connections[\s\S]*ORDER BY from_event,to_event/);
});

test("evento atual é derivado da rodada exata em vez de duplicado em game_rooms", () => {
  const service = readFileSync("src/lib/server/events/event-selection-service.ts", "utf8");
  const schema = readFileSync("src/lib/db/schema.sql", "utf8");

  assert.match(service, /getRoomRoundEvent\([\s\S]*currentRoundNumber/);
  assert.doesNotMatch(service, /getLatestRoomEvent/);
  assert.doesNotMatch(schema, /active_event_id|recent_event_ids/);
});
