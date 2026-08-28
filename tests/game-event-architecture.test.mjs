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
    assert.match(source, /CHECK \(to_event <> 0\)/);
    assert.match(source, /weight INTEGER NOT NULL CHECK \(weight > 0\)/);
    assert.match(source, /jsonb_typeof\(resolved_effects\) = 'array'/);
  }
});

test("repository recebe PoolClient e não abre transações ou pools próprios", () => {
  const source = readFileSync("src/lib/events/event-repository.ts", "utf8");

  assert.match(source, /type \{ PoolClient \} from "pg"/);
  assert.doesNotMatch(source, /from ["']@\/src\/lib\/db\/pool["']/);
  assert.doesNotMatch(source, /\bpool\.connect\(/);
  assert.doesNotMatch(source, /BEGIN|COMMIT|ROLLBACK/);
});

test("histórico é lido da tabela de rodadas em ordem decrescente e com janela limitada", () => {
  const source = readFileSync("src/lib/events/event-repository.ts", "utf8");

  assert.match(source, /FROM game_round_events/);
  assert.match(source, /ORDER BY round_number DESC/);
  assert.match(source, /LIMIT \$2/);
});

test("serviço mantém aleatoriedade na borda e domínio livre de Math.random", () => {
  const service = readFileSync("src/lib/events/event-selection-service.ts", "utf8");
  const selector = readFileSync("src/lib/events/event-selector.ts", "utf8");

  assert.match(service, /randomInt\(totalWeight\)/);
  assert.match(service, /EVENT_HISTORY_SIZE/);
  assert.match(service, /eligibleEventConnections/);
  assert.match(service, /selectWeightedEvent/);
  assert.doesNotMatch(service, /Promise\.all/);
  assert.doesNotMatch(selector, /Math\.random|node:crypto|server-only|PoolClient/);
});

test("evento atual é derivado do histórico persistido em vez de duplicado em game_rooms", () => {
  const service = readFileSync("src/lib/events/event-selection-service.ts", "utf8");
  const schema = readFileSync("src/lib/db/schema.sql", "utf8");

  assert.match(service, /getLatestRoomEvent\(client, roomId\)/);
  assert.doesNotMatch(schema, /active_event_id|recent_event_ids/);
});
