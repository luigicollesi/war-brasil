import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

function urlForDatabase(name) {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function withTemporaryDatabase(callback) {
  const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const name = `war_history_${suffix}`;
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

async function prepareDatabase(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(readFileSync("src/lib/db/schema.sql", "utf8"));
  } finally {
    await client.end();
  }

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

async function createUser(client, label) {
  const result = await client.query(
    `INSERT INTO auth."user"(name,email,"emailVerified")
     VALUES($1,$2,TRUE)
     RETURNING id`,
    [label, `${label.toLowerCase()}-${Date.now()}-${Math.random()}@example.invalid`],
  );
  return result.rows[0].id;
}

async function createMatch(client, roomId, sequence, mode) {
  const result = await client.query(
    `INSERT INTO game.matches(
       room_id,sequence,requested_profile_id,resolved_profile_id,
       profile_source,dice_balance_profile_snapshot,match_mode_snapshot,
       started_at,finished_at
     )
     VALUES(
       $1,$2,'adaptive-halves-v1','adaptive-halves-v1','catalog','{}'::jsonb,$3,
       NOW() - INTERVAL '20 minutes',NOW()
     )
     RETURNING id`,
    [roomId, sequence, mode],
  );
  return result.rows[0].id;
}

if (!databaseUrl) {
  test("match history migration exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("036 preserva snapshots de rematches, resultados e identidade histórica", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const client = new Client({ connectionString });
      await client.connect();

      try {
        const userA = await createUser(client, "HistoryA");
        const userB = await createUser(client, "HistoryB");

        await client.query(
          `INSERT INTO profile.commanders(user_id,handle,display_name)
           VALUES($1,'history-a','History A'),($2,'history-b','History B')`,
          [userA, userB],
        );

        const room = await client.query(
          `INSERT INTO game.rooms(code,match_mode)
           VALUES('HIST001','custom')
           RETURNING id`,
        );
        const roomId = room.rows[0].id;

        const players = await client.query(
          `INSERT INTO game.players(
             room_id,player_session,faction_name,color,user_id,
             display_name_snapshot,handle_snapshot
           )
           VALUES
             ($1,'00000000-0000-4000-8000-000000000101','Facção A','forest',$2,'History A','history-a'),
             ($1,'00000000-0000-4000-8000-000000000102','Facção B','ocean',$3,'History B','history-b')
           RETURNING id,user_id`,
          [roomId, userA, userB],
        );
        const playerA = players.rows.find((row) => row.user_id === userA);
        const playerB = players.rows.find((row) => row.user_id === userB);
        assert.ok(playerA);
        assert.ok(playerB);

        const firstMatchId = await createMatch(client, roomId, 1, "custom");
        await client.query(
          `INSERT INTO game.match_participants(
             match_id,player_id_snapshot,user_id,display_name_snapshot,handle_snapshot,
             faction_name_snapshot,color_snapshot,is_bot,is_winner
           ) VALUES
             ($1,$2,$3,'History A','history-a','Facção A','forest',FALSE,TRUE),
             ($1,$4,$5,'History B','history-b','Facção B','ocean',FALSE,FALSE)`,
          [firstMatchId, playerA.id, userA, playerB.id, userB],
        );

        const secondMatchId = await createMatch(client, roomId, 2, "classic");
        await client.query(
          `INSERT INTO game.match_participants(
             match_id,player_id_snapshot,user_id,display_name_snapshot,handle_snapshot,
             faction_name_snapshot,color_snapshot,is_bot,is_winner
           ) VALUES
             ($1,$2,$3,'History A','history-a','Facção A','forest',FALSE,FALSE),
             ($1,$4,$5,'History B','history-b','Facção B','ocean',FALSE,TRUE)`,
          [secondMatchId, playerA.id, userA, playerB.id, userB],
        );

        await client.query(
          `UPDATE profile.commanders
              SET display_name='History A Renamed',handle='history-a-renamed'
            WHERE user_id=$1`,
          [userA],
        );

        const beforeDeletion = await client.query(
          `SELECT match.sequence,match.match_mode_snapshot,
                  participant.display_name_snapshot,participant.handle_snapshot,
                  participant.is_winner
             FROM game.match_participants participant
             JOIN game.matches match ON match.id=participant.match_id
            WHERE participant.user_id=$1
            ORDER BY match.sequence`,
          [userA],
        );
        assert.deepEqual(beforeDeletion.rows, [
          {
            sequence: 1,
            match_mode_snapshot: "custom",
            display_name_snapshot: "History A",
            handle_snapshot: "history-a",
            is_winner: true,
          },
          {
            sequence: 2,
            match_mode_snapshot: "classic",
            display_name_snapshot: "History A",
            handle_snapshot: "history-a",
            is_winner: false,
          },
        ]);

        await client.query(`DELETE FROM auth."user" WHERE id=$1`, [userA]);

        const afterDeletion = await client.query(
          `SELECT match.sequence,participant.user_id,
                  participant.display_name_snapshot,participant.handle_snapshot,
                  participant.is_winner
             FROM game.match_participants participant
             JOIN game.matches match ON match.id=participant.match_id
            WHERE participant.player_id_snapshot=$1
            ORDER BY match.sequence`,
          [playerA.id],
        );
        assert.deepEqual(afterDeletion.rows, [
          {
            sequence: 1,
            user_id: null,
            display_name_snapshot: "History A",
            handle_snapshot: "history-a",
            is_winner: true,
          },
          {
            sequence: 2,
            user_id: null,
            display_name_snapshot: "History A",
            handle_snapshot: "history-a",
            is_winner: false,
          },
        ]);

        const survivingOpponentHistory = await client.query(
          `SELECT match.sequence,participant.is_winner
             FROM game.match_participants participant
             JOIN game.matches match ON match.id=participant.match_id
            WHERE participant.user_id=$1
            ORDER BY match.sequence`,
          [userB],
        );
        assert.deepEqual(survivingOpponentHistory.rows, [
          { sequence: 1, is_winner: false },
          { sequence: 2, is_winner: true },
        ]);
      } finally {
        await client.end();
      }
    });
  });
}
