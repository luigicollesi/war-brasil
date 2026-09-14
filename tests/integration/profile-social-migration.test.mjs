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
  const name = `war_social_${suffix}`;
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

if (!databaseUrl) {
  test("social graph migration exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("035 impõe requests únicos, friendship canônica, blocks direcionais e cascade", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const client = new Client({ connectionString });
      await client.connect();
      try {
        const userA = await createUser(client, "SocialA");
        const userB = await createUser(client, "SocialB");
        const userC = await createUser(client, "SocialC");

        await assert.rejects(
          client.query(
            `INSERT INTO social.friend_requests(requester_id,recipient_id)
             VALUES($1,$1)`,
            [userA],
          ),
          (error) => error?.code === "23514",
        );

        const request = await client.query(
          `INSERT INTO social.friend_requests(requester_id,recipient_id)
           VALUES($1,$2)
           RETURNING id,state,resolved_at`,
          [userA, userB],
        );
        assert.equal(request.rows[0].state, "pending");
        assert.equal(request.rows[0].resolved_at, null);

        await assert.rejects(
          client.query(
            `INSERT INTO social.friend_requests(requester_id,recipient_id)
             VALUES($1,$2)`,
            [userB, userA],
          ),
          (error) => error?.code === "23505",
        );

        await client.query(
          `UPDATE social.friend_requests
              SET state='accepted', resolved_at=NOW()
            WHERE id=$1`,
          [request.rows[0].id],
        );

        await assert.rejects(
          client.query(
            `UPDATE social.friend_requests
                SET state='pending'
              WHERE id=$1`,
            [request.rows[0].id],
          ),
          (error) => error?.code === "23514",
        );

        const canonical = await client.query(
          `SELECT LEAST($1::uuid,$2::uuid) AS user_a,
                  GREATEST($1::uuid,$2::uuid) AS user_b`,
          [userA, userB],
        );
        const userLow = canonical.rows[0].user_a;
        const userHigh = canonical.rows[0].user_b;

        await client.query(
          `INSERT INTO social.friendships(user_a_id,user_b_id)
           VALUES($1,$2)`,
          [userLow, userHigh],
        );

        await assert.rejects(
          client.query(
            `INSERT INTO social.friendships(user_a_id,user_b_id)
             VALUES($1,$2)`,
            [userHigh, userLow],
          ),
          (error) => error?.code === "23514",
        );

        await assert.rejects(
          client.query(
            `INSERT INTO social.blocks(blocker_id,blocked_id)
             VALUES($1,$1)`,
            [userC],
          ),
          (error) => error?.code === "23514",
        );

        await client.query(
          `INSERT INTO social.blocks(blocker_id,blocked_id)
           VALUES($1,$2)`,
          [userC, userA],
        );
        await client.query(
          `INSERT INTO social.blocks(blocker_id,blocked_id)
           VALUES($1,$2)`,
          [userA, userC],
        );

        await client.query(`DELETE FROM auth."user" WHERE id=$1`, [userA]);

        const remaining = await client.query(
          `SELECT
             (SELECT COUNT(*)::int FROM social.friend_requests
               WHERE requester_id=$1 OR recipient_id=$1) AS requests,
             (SELECT COUNT(*)::int FROM social.friendships
               WHERE user_a_id=$1 OR user_b_id=$1) AS friendships,
             (SELECT COUNT(*)::int FROM social.blocks
               WHERE blocker_id=$1 OR blocked_id=$1) AS blocks`,
          [userA],
        );
        assert.deepEqual(remaining.rows[0], {
          requests: 0,
          friendships: 0,
          blocks: 0,
        });
      } finally {
        await client.end();
      }
    });
  });
}
