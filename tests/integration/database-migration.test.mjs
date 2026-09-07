import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const physicalTables = new Map([
  [
    "game",
    [
      "cards",
      "matches",
      "order_rolls",
      "player_dice_states",
      "player_objectives",
      "players",
      "rematch_votes",
      "rooms",
      "round_events",
      "territories",
      "trade_offers",
    ],
  ],
  [
    "catalog",
    [
      "bot_names",
      "dice_balance_profiles",
      "dice_balance_settings",
      "event_connections",
      "events",
      "objective_rules",
      "objectives",
      "territory_card_symbols",
      "territory_connections",
    ],
  ],
  ["ops", ["command_receipts", "pgmigrations"]],
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
  "territory_card_symbols",
  "territory_connections",
].sort();

const managedHistory = [
  "026-organize-database-schemas.sql",
  "027-normalize-schema-table-names.sql",
  "028-normalize-rooms-phase-constraint.sql",
  "029-adaptive-combat-dice.sql",
];

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

function runPrepareResult(connectionString) {
  return spawnSync(process.execPath, ["scripts/prepare-dev-db.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: connectionString },
  });
}

function runPrepare(connectionString) {
  const result = runPrepareResult(connectionString);
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

function migrationUpSql(path) {
  const source = readFileSync(path, "utf8");
  const upMarker = "-- Up Migration";
  const downMarker = "-- Down Migration";
  const upIndex = source.indexOf(upMarker);
  assert.notEqual(upIndex, -1, `${path} sem ${upMarker}`);
  const downIndex = source.indexOf(downMarker, upIndex + upMarker.length);
  return source
    .slice(upIndex + upMarker.length, downIndex < 0 ? source.length : downIndex)
    .trim();
}

async function prepareLegacyDatabaseTo028(connectionString) {
  await applySql(connectionString, "tests/fixtures/db/schema-v025.sql");
  await applySql(
    connectionString,
    "tests/fixtures/db/schema-v025-supplement.sql",
  );

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA IF NOT EXISTS ops");
    await client.query(`
      CREATE TABLE IF NOT EXISTS ops.pgmigrations (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        run_on TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const name of managedHistory.slice(0, 3)) {
      await client.query(
        migrationUpSql(`src/lib/db/migrations/managed/${name}`),
      );
      await client.query("INSERT INTO ops.pgmigrations(name) VALUES($1)", [name]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function assertLegacyCatalogPreserved(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const symbol = await client.query(
      "SELECT symbol FROM catalog.territory_card_symbols WHERE territory_id=1",
    );
    assert.equal(symbol.rows[0]?.symbol, "leaf");

    const connection = await client.query(`
      SELECT is_passable, barrier_name, description
      FROM catalog.territory_connections
      WHERE territory_a=1 AND territory_b=2
    `);
    assert.deepEqual(connection.rows[0], {
      is_passable: false,
      barrier_name: "fixture-barrier",
      description: "fixture-connection",
    });
  } finally {
    await client.end();
  }
}

async function assertAdaptiveDiceSchema(client) {
  const profiles = await client.query(`
    SELECT id,algorithm,alpha,pressure_cap,dead_zone,retention_per_round,
           max_group_shift,inner_tilt,min_face_probability,max_face_probability
    FROM catalog.dice_balance_profiles
    ORDER BY id
  `);
  assert.deepEqual(
    profiles.rows.map((row) => row.id),
    ["adaptive-halves-v1", "uniform-v1"],
  );

  const adaptive = profiles.rows.find((row) => row.id === "adaptive-halves-v1");
  assert.equal(adaptive.algorithm, "adaptive_halves");
  assert.equal(Number(adaptive.alpha), 0.12);
  assert.equal(Number(adaptive.pressure_cap), 0.6);
  assert.equal(Number(adaptive.dead_zone), 0.1);
  assert.equal(Number(adaptive.retention_per_round), 0.8);
  assert.equal(Number(adaptive.max_group_shift), 0.2);
  assert.equal(Number(adaptive.inner_tilt), 0.03);

  const setting = await client.query(
    "SELECT default_profile_id FROM catalog.dice_balance_settings WHERE id=1",
  );
  assert.equal(setting.rows[0]?.default_profile_id, "adaptive-halves-v1");

  const roomColumns = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='game' AND table_name='rooms'
  `);
  assert.equal(
    roomColumns.rows.some((row) => row.column_name === "current_match_id"),
    true,
  );

  const triggers = await client.query(`
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid IN (
      'catalog.dice_balance_profiles'::regclass,
      'game.matches'::regclass
    ) AND NOT tgisinternal
  `);
  const triggerNames = new Set(triggers.rows.map((row) => row.tgname));
  assert.equal(triggerNames.has("dice_balance_profiles_append_only"), true);
  assert.equal(triggerNames.has("matches_dice_profile_immutable"), true);
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
    assert.deepEqual(history.rows.map((row) => row.name), managedHistory);

    await assertAdaptiveDiceSchema(client);

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
      "SELECT COUNT(*)::int AS count FROM game.rematch_votes WHERE room_id=$1",
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
      "SELECT pg_get_serial_sequence('game.rooms', 'id') AS name",
    );
    assert.equal(sequence.rows[0].name, "game.rooms_id_seq");

    const roomConstraints = await client.query(`
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='game' AND t.relname='rooms'
    `);
    const roomConstraintNames = new Set(
      roomConstraints.rows.map((row) => row.conname),
    );
    for (const name of [
      "rooms_pkey",
      "rooms_code_key",
      "rooms_status_check",
      "rooms_phase_check",
      "rooms_current_player_fkey",
      "rooms_winner_player_fkey",
      "rooms_current_match_fkey",
    ]) {
      assert.equal(roomConstraintNames.has(name), true, name);
    }

    const tradeConstraints = await client.query(`
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='game' AND t.relname='trade_offers'
    `);
    const tradeConstraintNames = new Set(
      tradeConstraints.rows.map((row) => row.conname),
    );
    for (const name of [
      "trade_offers_status_check",
      "trade_offers_target_player_check",
      "trade_offers_offered_descriptor_check",
      "trade_offers_requested_descriptor_check",
      "trade_offers_counter_descriptor_check",
      "trade_offers_responder_check",
      "trade_offers_state_check",
    ]) {
      assert.equal(tradeConstraintNames.has(name), true, name);
    }

    const indexes = await client.query(`
      SELECT schemaname, indexname
      FROM pg_indexes
      WHERE schemaname IN ('game', 'ops')
    `);
    const indexNames = new Set(indexes.rows.map((row) => row.indexname));
    for (const name of [
      "rooms_automation_due_idx",
      "players_room_id_idx",
      "territories_room_owner_idx",
      "trade_offers_one_active_idx",
      "command_receipts_room_created_idx",
    ]) {
      assert.equal(indexNames.has(name), true, name);
    }
    for (const legacyPrefix of [
      "game_rooms_",
      "room_players_",
      "game_territories_",
      "game_player_trade_offers_",
      "game_command_receipts_",
    ]) {
      assert.equal(
        [...indexNames].some((name) => name.startsWith(legacyPrefix)),
        false,
        legacyPrefix,
      );
    }
  } finally {
    await client.end();
  }
}

async function assertLegacyRoomRollout(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const rooms = await client.query(`
      SELECT code,status,current_match_id
      FROM game.rooms
      WHERE code LIKE 'ROLL_%'
      ORDER BY code
    `);
    const byCode = new Map(rooms.rows.map((row) => [row.code, row]));

    assert.equal(byCode.get("ROLL_WAIT")?.current_match_id, null);
    assert.ok(byCode.get("ROLL_ORDER")?.current_match_id);
    assert.ok(byCode.get("ROLL_PLAY")?.current_match_id);
    assert.equal(byCode.get("ROLL_DONE")?.current_match_id, null);

    const matches = await client.query(`
      SELECT room.code,match.resolved_profile_id,match.profile_source,
             match.finished_at,match.dice_balance_profile_snapshot
      FROM game.matches match
      JOIN game.rooms room ON room.id=match.room_id
      WHERE room.code LIKE 'ROLL_%'
      ORDER BY room.code
    `);
    const matchByCode = new Map(matches.rows.map((row) => [row.code, row]));

    assert.equal(matchByCode.has("ROLL_WAIT"), false);
    for (const code of ["ROLL_ORDER", "ROLL_PLAY", "ROLL_DONE"]) {
      const match = matchByCode.get(code);
      assert.equal(match?.resolved_profile_id, "uniform-v1", code);
      assert.equal(match?.profile_source, "catalog", code);
      assert.equal(match?.dice_balance_profile_snapshot.algorithm, "uniform", code);
    }
    assert.equal(matchByCode.get("ROLL_ORDER")?.finished_at, null);
    assert.equal(matchByCode.get("ROLL_PLAY")?.finished_at, null);
    assert.ok(matchByCode.get("ROLL_DONE")?.finished_at);

    const states = await client.query(`
      SELECT COUNT(*)::int count
      FROM game.player_dice_states state
      JOIN game.matches match ON match.id=state.match_id
      JOIN game.rooms room ON room.id=match.room_id
      WHERE room.code LIKE 'ROLL_%'
    `);
    assert.equal(states.rows[0].count, 0);
  } finally {
    await client.end();
  }
}

if (!databaseUrl) {
  test("migrations de banco exigem DATABASE_URL", { skip: true }, () => {});
} else {
  test("026-029 migram banco v025, preservam catálogos e são idempotentes", async () => {
    await withTemporaryDatabase("legacy", async (connectionString) => {
      await applySql(connectionString, "tests/fixtures/db/schema-v025.sql");
      await applySql(
        connectionString,
        "tests/fixtures/db/schema-v025-supplement.sql",
      );
      runPrepare(connectionString);
      runPrepare(connectionString);
      await assertOrganizedDatabase(connectionString);
      await assertLegacyCatalogPreserved(connectionString);
    });
  });

  test("029 preserva partidas existentes como uniformes e deixa waiting sem match", async () => {
    await withTemporaryDatabase("adaptive-rollout", async (connectionString) => {
      await prepareLegacyDatabaseTo028(connectionString);

      const client = new Client({ connectionString });
      await client.connect();
      try {
        await client.query(`
          INSERT INTO game.rooms(code,status,phase) VALUES
            ('ROLL_WAIT','waiting','trade'),
            ('ROLL_ORDER','order_roll','cards'),
            ('ROLL_PLAY','playing','attack'),
            ('ROLL_DONE','finished','finished')
        `);
      } finally {
        await client.end();
      }

      runPrepare(connectionString);
      await assertLegacyRoomRollout(connectionString);
    });
  });

  test("runner rejeita public.* incompleto em vez de tratar como v025", async () => {
    await withTemporaryDatabase("old-baseline", async (connectionString) => {
      await applySql(connectionString, "tests/fixtures/db/schema-v025.sql");
      const result = runPrepareResult(connectionString);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Banco legado não corresponde ao baseline v025/);
      assert.match(result.stderr, /territory_card_symbols/);
      assert.match(result.stderr, /territory_connections/);
    });
  });

  test("schema canônico novo converge ao estado físico final", async () => {
    await withTemporaryDatabase("clean", async (connectionString) => {
      await applySql(connectionString, "src/lib/db/schema.sql");
      runPrepare(connectionString);
      await assertOrganizedDatabase(connectionString);
    });
  });
}
