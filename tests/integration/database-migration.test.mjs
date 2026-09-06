import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const physicalTables = new Map([
  ["game", [
    "game_cards",
    "game_order_rolls",
    "game_player_objectives",
    "game_player_trade_offers",
    "game_rematch_votes",
    "game_rooms",
    "game_round_events",
    "game_territories",
    "room_players",
  ]],
  ["catalog", [
    "bot_names",
    "event_connections",
    "events",
    "objective_rules",
    "objectives",
  ]],
  ["ops", ["game_command_receipts", "pgmigrations"]],
]);

const compatibilityViews = [
  "bot_names",
  "event_connections",
  "events",
  "game_cards",
  "game_command_receipts",
  "game_order_rolls",
  "game_player_objectives",
  "game_player_trade_offers",
  "game_rematch_votes",
  "game_rooms",
  "game_round_events",
  "game_territories",
  "objective_rules",
  "objectives",
  "room_players",
].sort();

function urlForDatabase(name) {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function withTemporaryDatabase(label, callback) {
  const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const name = `war_${label}_${suffix}`;
  const admin = new Client({ connectionString: databaseUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    await callback(urlForDatabase(name));
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
}

function runPrepare(connectionString) {
  const result = spawnSync(process.execPath, ["scripts/prepare-dev-db.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: connectionString },
  });
  assert.equal(
    result.status,
    0,
    `prepare-dev-db falhou:\n${result.stdout}\n${result.stderr}`,
  );
}

async function applySql(connectionString, path) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(readFileSync(path, "utf8"));
  } finally {
    await client.end();
  }
}

async function assertOrganizedDatabase(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const relations = await client.query(`
      SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('game', 'catalog', 'ops', 'public')
        AND c.relkind IN ('r', 'p', 'v')
      ORDER BY n.nspname, c.relname
    `);

    for (const [schemaName, names] of physicalTables) {
      const actual = relations.rows
        .filter(
          (row) =>
            row.schema_name === schemaName &&
            (row.relkind === "r" || row.relkind === "p"),
        )
        .map((row) => row.relation_name)
        .sort();
      assert.deepEqual(actual, [...names].sort(), schemaName);
    }

    const publicTables = relations.rows.filter(
      (row) =>
        row.schema_name === "public" &&
        (row.relkind === "r" || row.relkind === "p"),
    );
    assert.deepEqual(publicTables, []);

    const views = relations.rows
      .filter((row) => row.schema_name === "public" && row.relkind === "v")
      .map((row) => row.relation_name)
      .sort();
    assert.deepEqual(views, compatibilityViews);

    const history = await client.query(
      "SELECT name FROM ops.pgmigrations ORDER BY id",
    );
    assert.deepEqual(history.rows.map((row) => row.name), [
      "026-organize-database-schemas.sql",
    ]);

    const room = await client.query(
      "INSERT INTO public.game_rooms(code) VALUES('MIGRATION') RETURNING id, revision",
    );
    const roomId = room.rows[0].id;
    assert.equal(room.rows[0].revision, 1);

    const player = await client.query(
      `INSERT INTO public.room_players(
         room_id, player_session, faction_name, color
       ) VALUES($1, '00000000-0000-4000-8000-000000000001', 'Migração', 'forest')
       RETURNING id`,
      [roomId],
    );
    const playerId = player.rows[0].id;

    await client.query(
      `INSERT INTO public.game_rematch_votes(room_id, player_id)
       VALUES($1, $2)
       ON CONFLICT (room_id, player_id) DO NOTHING`,
      [roomId, playerId],
    );
    await client.query(
      `INSERT INTO public.game_rematch_votes(room_id, player_id)
       VALUES($1, $2)
       ON CONFLICT (room_id, player_id) DO NOTHING`,
      [roomId, playerId],
    );
    const voteCount = await client.query(
      "SELECT COUNT(*)::int AS count FROM game.game_rematch_votes WHERE room_id=$1",
      [roomId],
    );
    assert.equal(voteCount.rows[0].count, 1);

    const update = await client.query(
      "UPDATE public.game_rooms SET revision=revision+1 WHERE id=$1 RETURNING revision",
      [roomId],
    );
    assert.equal(update.rows[0].revision, 2);

    await client.query("BEGIN");
    const locked = await client.query(
      "SELECT id FROM public.game_rooms WHERE id=$1 FOR UPDATE",
      [roomId],
    );
    assert.equal(String(locked.rows[0].id), String(roomId));
    await client.query("ROLLBACK");

    await client.query(
      "DELETE FROM public.game_rematch_votes WHERE room_id=$1 AND player_id=$2",
      [roomId, playerId],
    );

    const sequence = await client.query(
      "SELECT pg_get_serial_sequence('game.game_rooms', 'id') AS name",
    );
    assert.equal(sequence.rows[0].name, "game.game_rooms_id_seq");

    const constraints = await client.query(`
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='game' AND t.relname='game_rooms'
    `);
    const constraintNames = new Set(constraints.rows.map((row) => row.conname));
    for (const name of [
      "game_rooms_pkey",
      "game_rooms_code_key",
      "game_rooms_status_check",
      "game_rooms_phase_check",
      "game_rooms_current_player_fkey",
      "game_rooms_winner_player_fkey",
    ]) {
      assert.equal(constraintNames.has(name), true, name);
    }
  } finally {
    await client.end();
  }
}

if (!databaseUrl) {
  test("migrations de banco exigem DATABASE_URL", { skip: true }, () => {});
} else {
  test("026 migra banco v025, mantém compatibilidade e é idempotente", async () => {
    await withTemporaryDatabase("legacy", async (connectionString) => {
      await applySql(connectionString, "tests/fixtures/db/schema-v025.sql");
      runPrepare(connectionString);
      runPrepare(connectionString);
      await assertOrganizedDatabase(connectionString);
    });
  });

  test("schema canônico novo converge para o mesmo estado gerenciado", async () => {
    await withTemporaryDatabase("clean", async (connectionString) => {
      await applySql(connectionString, "src/lib/db/schema.sql");
      runPrepare(connectionString);
      await assertOrganizedDatabase(connectionString);
    });
  });
}
