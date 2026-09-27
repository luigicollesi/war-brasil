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
  const name = `war_bp_concurrency_${suffix}`;
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

function prepareDatabase(connectionString) {
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


async function createUser(client) {
  const result = await client.query(
    `INSERT INTO auth."user"(name,email,"emailVerified")
     VALUES('Battle Pass Concurrency',$1,TRUE)
     RETURNING id`,
    [`bp-concurrency-${Date.now()}-${Math.random()}@example.invalid`],
  );
  return result.rows[0].id;
}

if (!databaseUrl) {
  test("battle pass concurrency exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("XP ledger e claims preservam unicidade sob duas conexões", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      const bootstrap = new Client({ connectionString });
      await bootstrap.connect();
      try {
        await bootstrap.query(readFileSync("src/lib/db/schema.sql", "utf8"));
      } finally {
        await bootstrap.end();
      }
      prepareDatabase(connectionString);

      const setup = new Client({ connectionString });
      const clientA = new Client({ connectionString });
      const clientB = new Client({ connectionString });
      await setup.connect();
      await clientA.connect();
      await clientB.connect();

      try {
        const userId = await createUser(setup);

        await setup.query(
          `INSERT INTO catalog.battle_pass_xp_profiles(
             id,completion_xp,victory_bonus_xp,solo_human_bot_multiplier_bps
           )
           VALUES('bp-concurrency-v1',100,50,4000)`,
        );
        await setup.query(
          `INSERT INTO catalog.battle_pass_seasons(
             id,slug,name,starts_at,ends_at,claim_ends_at,status,xp_profile_id
           )
           VALUES(
             'season.bp-concurrency','bp-concurrency','BP Concurrency',
             '2026-01-01T00:00:00Z','2026-12-01T00:00:00Z',
             '2027-01-01T00:00:00Z','draft','bp-concurrency-v1'
           )`,
        );
        await setup.query(
          `INSERT INTO catalog.battle_pass_levels(
             season_id,level,required_total_xp
           )
           VALUES('season.bp-concurrency',1,0)`,
        );
        await setup.query(
          `INSERT INTO catalog.battle_pass_rewards(
             id,season_id,level,track,position,reward_kind,credit_amount
           )
           VALUES(
             'reward.bp-concurrency.credit',
             'season.bp-concurrency',
             1,'free',0,'campaign_credit',5
           )`,
        );

        const xpSql = `
          INSERT INTO progression.battle_pass_xp_entries(
            season_id,user_id,source_type,source_key,amount,metadata
          )
          VALUES(
            'season.bp-concurrency',$1::uuid,'match','match-42',100,'{}'::jsonb
          )
          ON CONFLICT (season_id,user_id,source_type,source_key) DO NOTHING
          RETURNING id
        `;

        const [xpA, xpB] = await Promise.all([
          clientA.query(xpSql, [userId]),
          clientB.query(xpSql, [userId]),
        ]);
        assert.equal(
          (xpA.rowCount ?? 0) + (xpB.rowCount ?? 0),
          1,
          "duas conexões não podem registrar XP duplicado para o mesmo match",
        );

        const xpRows = await setup.query(
          `SELECT COUNT(*)::int AS count,SUM(amount)::int AS total
             FROM progression.battle_pass_xp_entries
            WHERE season_id='season.bp-concurrency'
              AND user_id=$1::uuid
              AND source_type='match'
              AND source_key='match-42'`,
          [userId],
        );
        assert.deepEqual(xpRows.rows[0], { count: 1, total: 100 });

        const claimSql = `
          INSERT INTO progression.battle_pass_reward_claims(
            user_id,reward_id,season_id
          )
          VALUES(
            $1::uuid,'reward.bp-concurrency.credit','season.bp-concurrency'
          )
          ON CONFLICT (user_id,reward_id) DO NOTHING
          RETURNING reward_id
        `;

        const [claimA, claimB] = await Promise.all([
          clientA.query(claimSql, [userId]),
          clientB.query(claimSql, [userId]),
        ]);
        assert.equal(
          (claimA.rowCount ?? 0) + (claimB.rowCount ?? 0),
          1,
          "duas conexões não podem registrar o mesmo claim duas vezes",
        );

        const claimRows = await setup.query(
          `SELECT COUNT(*)::int AS count
             FROM progression.battle_pass_reward_claims
            WHERE user_id=$1::uuid
              AND reward_id='reward.bp-concurrency.credit'`,
          [userId],
        );
        assert.deepEqual(claimRows.rows[0], { count: 1 });
      } finally {
        await Promise.all([
          setup.end(),
          clientA.end(),
          clientB.end(),
        ]);
      }
    });
  });
}
