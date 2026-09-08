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

async function expectPgError(client, sql, params, expected) {
  await assert.rejects(
    client.query(sql, params),
    (error) => {
      assert.equal(error?.code, expected.code);
      if (expected.constraint) {
        assert.equal(error?.constraint, expected.constraint);
      }
      if (expected.message) {
        assert.match(String(error?.message), expected.message);
      }
      return true;
    },
  );
}

async function createFixture(client) {
  const roomA = (
    await client.query(
      "INSERT INTO game.rooms(code) VALUES('DICE_A') RETURNING id",
    )
  ).rows[0];
  const roomB = (
    await client.query(
      "INSERT INTO game.rooms(code) VALUES('DICE_B') RETURNING id",
    )
  ).rows[0];
  const playerA = (
    await client.query(
      `INSERT INTO game.players(
         room_id,player_session,faction_name,color
       ) VALUES($1,'00000000-0000-4000-8000-000000000011','Teste A','forest')
       RETURNING id`,
      [roomA.id],
    )
  ).rows[0];

  const snapshot = {
    algorithm: "adaptive_halves",
    alpha: 0.12,
    pressureCap: 0.6,
    deadZone: 0.1,
    retentionPerRound: 0.8,
    maxGroupShift: 0.2,
    innerTilt: 0.03,
    minFaceProbability: 0.09,
    maxFaceProbability: 0.27,
  };

  const match = (
    await client.query(
      `INSERT INTO game.matches(
         room_id,sequence,requested_profile_id,resolved_profile_id,
         profile_source,dice_balance_profile_snapshot
       ) VALUES($1,1,'adaptive-halves-v1','adaptive-halves-v1','catalog',$2::jsonb)
       RETURNING id`,
      [roomA.id, JSON.stringify(snapshot)],
    )
  ).rows[0];

  await client.query(
    "UPDATE game.rooms SET current_match_id=$2 WHERE id=$1",
    [roomA.id, match.id],
  );
  await client.query(
    "INSERT INTO game.player_dice_states(match_id,player_id) VALUES($1,$2)",
    [match.id, playerA.id],
  );

  return {
    roomAId: roomA.id,
    roomBId: roomB.id,
    playerAId: playerA.id,
    matchId: match.id,
  };
}

if (!databaseUrl) {
  test("constraints adaptativas exigem DATABASE_URL", { skip: true }, () => {});
} else {
  test("PostgreSQL protege perfis, snapshots, room/match e estado adaptativo", async () => {
    await withTemporaryDatabase("dice_constraints", async (connectionString) => {
      const client = new Client({ connectionString });
      await client.connect();
      try {
        await client.query(readFileSync("src/lib/db/schema.sql", "utf8"));
        const fixture = await createFixture(client);

        await expectPgError(
          client,
          "UPDATE catalog.dice_balance_profiles SET alpha=0.2 WHERE id='adaptive-halves-v1'",
          [],
          {
            code: "P0001",
            message: /append-only/,
          },
        );
        await expectPgError(
          client,
          "DELETE FROM catalog.dice_balance_profiles WHERE id='adaptive-halves-v1'",
          [],
          {
            code: "P0001",
            message: /append-only/,
          },
        );
        await expectPgError(
          client,
          `UPDATE game.matches
           SET dice_balance_profile_snapshot='{"algorithm":"uniform"}'::jsonb
           WHERE id=$1`,
          [fixture.matchId],
          {
            code: "P0001",
            message: /immutable/,
          },
        );
        await expectPgError(
          client,
          "UPDATE game.rooms SET current_match_id=$2 WHERE id=$1",
          [fixture.roomBId, fixture.matchId],
          {
            code: "23503",
            constraint: "rooms_current_match_fkey",
          },
        );
        await expectPgError(
          client,
          `UPDATE game.player_dice_states
           SET pressure=1.01
           WHERE match_id=$1 AND player_id=$2`,
          [fixture.matchId, fixture.playerAId],
          {
            code: "23514",
            constraint: "player_dice_states_pressure_check",
          },
        );
        await expectPgError(
          client,
          `UPDATE game.player_dice_states
           SET batch_count=-1
           WHERE match_id=$1 AND player_id=$2`,
          [fixture.matchId, fixture.playerAId],
          {
            code: "23514",
            constraint: "player_dice_states_batch_count_check",
          },
        );

        const state = await client.query(
          `SELECT pressure,batch_count,last_roll_round
           FROM game.player_dice_states
           WHERE match_id=$1 AND player_id=$2`,
          [fixture.matchId, fixture.playerAId],
        );
        assert.deepEqual(state.rows[0], {
          pressure: 0,
          batch_count: 0,
          last_roll_round: null,
        });
      } finally {
        await client.end();
      }
    });
  });
}
