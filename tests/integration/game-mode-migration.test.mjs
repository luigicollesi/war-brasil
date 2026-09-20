import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const migrationSource = readFileSync(
  "src/lib/db/migrations/managed/046-game-modes-objective-supremacy.sql",
  "utf8",
);
const upMarker = "-- Up Migration";
const downMarker = "-- Down Migration";
const upStart = migrationSource.indexOf(upMarker);
const downStart = migrationSource.indexOf(downMarker, upStart + upMarker.length);
const migrationSql = migrationSource
  .slice(upStart + upMarker.length, downStart >= 0 ? downStart : migrationSource.length)
  .trim();

function urlForDatabase(name) {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function withTemporaryDatabase(callback) {
  const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const name = `war_game_modes_${suffix}`;
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

async function prepareDatabase(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(readFileSync("src/lib/db/schema.sql", "utf8"));
  } finally {
    await client.end();
  }
  runPrepare(connectionString);
}

if (!databaseUrl) {
  test("game mode migration exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("046 persiste defaults de sala e congela settings no match", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const client = new Client({ connectionString });
      await client.connect();

      try {
        assert.ok(upStart >= 0, "migration 046 precisa manter marcador -- Up Migration");
        assert.ok(migrationSql.length > 0, "migration 046 precisa possuir SQL de up");

        // Idempotência de deploy/clean install: a migration precisa poder ser
        // reaplicada sobre o schema já convergido sem duplicar constraints.
        await client.query(migrationSql);

        const room = await client.query(
          `INSERT INTO game.rooms(code)
           VALUES('MODE046A')
           RETURNING id,ruleset,balanced_dice_enabled`,
        );
        const roomId = room.rows[0].id;
        assert.deepEqual(room.rows[0], {
          id: roomId,
          ruleset: "objective",
          balanced_dice_enabled: true,
        });

        await assert.rejects(
          client.query(
            `INSERT INTO game.rooms(code,ruleset)
             VALUES('MODE046B','unknown')`,
          ),
          (error) => error?.code === "23514",
        );

        const match = await client.query(
          `INSERT INTO game.matches(
             room_id,sequence,requested_profile_id,resolved_profile_id,
             profile_source,dice_balance_profile_snapshot,match_mode_snapshot,
             ruleset_snapshot,balanced_dice_enabled_snapshot
           )
           VALUES(
             $1,1,'uniform-v1','uniform-v1','catalog','{}'::jsonb,'custom',
             'supremacy',FALSE
           )
           RETURNING id,ruleset_snapshot,balanced_dice_enabled_snapshot`,
          [roomId],
        );
        const matchId = match.rows[0].id;
        assert.deepEqual(match.rows[0], {
          id: matchId,
          ruleset_snapshot: "supremacy",
          balanced_dice_enabled_snapshot: false,
        });

        await assert.rejects(
          client.query(
            `INSERT INTO game.matches(
               room_id,sequence,requested_profile_id,resolved_profile_id,
               profile_source,dice_balance_profile_snapshot,match_mode_snapshot,
               ruleset_snapshot,balanced_dice_enabled_snapshot
             )
             VALUES(
               $1,2,'uniform-v1','uniform-v1','catalog','{}'::jsonb,'custom',
               'unknown',TRUE
             )`,
            [roomId],
          ),
          (error) => error?.code === "23514",
        );

        await assert.rejects(
          client.query(
            `UPDATE game.matches
             SET ruleset_snapshot='objective'
             WHERE id=$1`,
            [matchId],
          ),
          (error) => error?.code === "P0001",
        );

        await assert.rejects(
          client.query(
            `UPDATE game.matches
             SET balanced_dice_enabled_snapshot=TRUE
             WHERE id=$1`,
            [matchId],
          ),
          (error) => error?.code === "P0001",
        );

        await assert.rejects(
          client.query(
            `UPDATE game.matches
             SET match_mode_snapshot='classic'
             WHERE id=$1`,
            [matchId],
          ),
          (error) => error?.code === "P0001",
        );
      } finally {
        await client.end();
      }
    });
  });
}
