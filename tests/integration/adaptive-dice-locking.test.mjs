import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

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

async function createAdaptiveState(client) {
  const room = (
    await client.query(
      "INSERT INTO game.rooms(code) VALUES('LOCKING') RETURNING id",
    )
  ).rows[0];
  const player = (
    await client.query(
      `INSERT INTO game.players(
         room_id,player_session,faction_name,color
       ) VALUES($1,'00000000-0000-4000-8000-000000000021','Lock','forest')
       RETURNING id`,
      [room.id],
    )
  ).rows[0];
  const match = (
    await client.query(
      `INSERT INTO game.matches(
         room_id,sequence,requested_profile_id,resolved_profile_id,
         profile_source,dice_balance_profile_snapshot
       ) VALUES(
         $1,1,'adaptive-halves-v1','adaptive-halves-v1','catalog',
         '{
           "algorithm":"adaptive_halves",
           "alpha":0.12,
           "pressureCap":0.6,
           "deadZone":0.1,
           "retentionPerRound":0.8,
           "maxGroupShift":0.2,
           "innerTilt":0.03,
           "minFaceProbability":0.09,
           "maxFaceProbability":0.27
         }'::jsonb
       ) RETURNING id`,
      [room.id],
    )
  ).rows[0];

  await client.query(
    "UPDATE game.rooms SET current_match_id=$2 WHERE id=$1",
    [room.id, match.id],
  );
  await client.query(
    "INSERT INTO game.player_dice_states(match_id,player_id) VALUES($1,$2)",
    [match.id, player.id],
  );

  return { matchId: match.id, playerId: player.id };
}

if (!databaseUrl) {
  test("locking adaptativo exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("FOR UPDATE serializa o state e rollback não persiste pressure", async () => {
    await withTemporaryDatabase("dice_lock", async (connectionString) => {
      const setup = new Client({ connectionString });
      await setup.connect();
      let ids;
      try {
        await setup.query(readFileSync("src/lib/db/schema.sql", "utf8"));
        ids = await createAdaptiveState(setup);
      } finally {
        await setup.end();
      }

      const first = new Client({ connectionString });
      const second = new Client({ connectionString });
      await first.connect();
      await second.connect();
      try {
        await first.query("BEGIN");
        await first.query(
          `SELECT pressure
           FROM game.player_dice_states
           WHERE match_id=$1 AND player_id=$2
           FOR UPDATE`,
          [ids.matchId, ids.playerId],
        );
        await first.query(
          `UPDATE game.player_dice_states
           SET pressure=0.4,batch_count=1,last_roll_round=1
           WHERE match_id=$1 AND player_id=$2`,
          [ids.matchId, ids.playerId],
        );

        await second.query("SET lock_timeout='100ms'");
        await assert.rejects(
          second.query(
            `SELECT pressure
             FROM game.player_dice_states
             WHERE match_id=$1 AND player_id=$2
             FOR UPDATE`,
            [ids.matchId, ids.playerId],
          ),
          (error) => {
            assert.equal(error?.code, "55P03");
            return true;
          },
        );

        await first.query("ROLLBACK");

        const lockedAfterRollback = await second.query(
          `SELECT pressure,batch_count,last_roll_round
           FROM game.player_dice_states
           WHERE match_id=$1 AND player_id=$2
           FOR UPDATE`,
          [ids.matchId, ids.playerId],
        );
        assert.deepEqual(lockedAfterRollback.rows[0], {
          pressure: 0,
          batch_count: 0,
          last_roll_round: null,
        });
      } finally {
        await first.query("ROLLBACK").catch(() => undefined);
        await second.query("ROLLBACK").catch(() => undefined);
        await first.end();
        await second.end();
      }
    });
  });
}
