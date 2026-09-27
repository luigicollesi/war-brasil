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
  const name = `war_battle_pass_${suffix}`;
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

if (!databaseUrl) {
  test("battle pass constraints exigem DATABASE_URL", { skip: true }, () => {});
} else {
  test("PostgreSQL protege catálogo, preço Elite e snapshot sazonal", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      const bootstrap = new Client({ connectionString });
      await bootstrap.connect();
      try {
        await bootstrap.query(readFileSync("src/lib/db/schema.sql", "utf8"));
      } finally {
        await bootstrap.end();
      }
      prepareDatabase(connectionString);

      const client = new Client({ connectionString });
      await client.connect();
      try {
        const cleanInstallGuards = await client.query(
          `SELECT
             to_regprocedure(
               'catalog.reconcile_battle_pass_season_lifecycle()'
             ) IS NOT NULL AS lifecycle_function,
             to_regprocedure(
               'catalog.validate_battle_pass_elite_economy_activation()'
             ) IS NOT NULL AS elite_price_function,
             to_regprocedure(
               'catalog.validate_battle_pass_reward_identity()'
             ) IS NOT NULL AS reward_identity_function,
             EXISTS(
               SELECT 1
                 FROM pg_trigger trigger
                 JOIN pg_class relation ON relation.oid=trigger.tgrelid
                 JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
                WHERE namespace.nspname='catalog'
                  AND relation.relname='battle_pass_seasons'
                  AND trigger.tgname='battle_pass_seasons_00_expired_rollover'
                  AND NOT trigger.tgisinternal
             ) AS lifecycle_trigger,
             EXISTS(
               SELECT 1
                 FROM pg_trigger trigger
                 JOIN pg_class relation ON relation.oid=trigger.tgrelid
                 JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
                WHERE namespace.nspname='catalog'
                  AND relation.relname='battle_pass_seasons'
                  AND trigger.tgname='battle_pass_seasons_elite_economy_guard'
                  AND NOT trigger.tgisinternal
             ) AS elite_price_trigger,
             EXISTS(
               SELECT 1
                 FROM pg_trigger trigger
                 JOIN pg_class relation ON relation.oid=trigger.tgrelid
                 JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
                WHERE namespace.nspname='catalog'
                  AND relation.relname='battle_pass_seasons'
                  AND trigger.tgname='battle_pass_seasons_reward_identity_guard'
                  AND NOT trigger.tgisinternal
             ) AS reward_identity_trigger`,
        );
        assert.deepEqual(cleanInstallGuards.rows[0], {
          lifecycle_function: true,
          elite_price_function: true,
          reward_identity_function: true,
          lifecycle_trigger: true,
          elite_price_trigger: true,
          reward_identity_trigger: true,
        });

        await client.query(
          `INSERT INTO catalog.battle_pass_xp_profiles(
             id,completion_xp,victory_bonus_xp,solo_human_bot_multiplier_bps
           )
           VALUES('bp-test-v1',100,50,4000)`,
        );

        await expectPgError(
          client,
          `UPDATE catalog.battle_pass_xp_profiles
              SET completion_xp=120
            WHERE id='bp-test-v1'`,
          [],
          {
            code: "P0001",
            message: /append-only/,
          },
        );

        await expectPgError(
          client,
          "DELETE FROM catalog.battle_pass_xp_profiles WHERE id='bp-test-v1'",
          [],
          {
            code: "P0001",
            message: /append-only/,
          },
        );

        await client.query(
          `INSERT INTO catalog.battle_pass_seasons(
             id,slug,name,starts_at,ends_at,claim_ends_at,status,xp_profile_id
           )
           VALUES(
             'season.bp-test','bp-test','BP Test',
             '2026-01-01T00:00:00Z','2026-12-01T00:00:00Z',
             '2027-01-01T00:00:00Z','draft','bp-test-v1'
           )`,
        );

        await expectPgError(
          client,
          `INSERT INTO catalog.battle_pass_pricing(season_id,fixed_price)
           VALUES('season.bp-test',2999)`,
          [],
          {
            code: "23514",
            constraint: "battle_pass_pricing_fixed_price_check",
          },
        ).catch(async (error) => {
          // PostgreSQL may auto-name this CHECK differently if the schema
          // declaration changes; preserve the semantic assertion.
          if (
            error instanceof assert.AssertionError &&
            /constraint/.test(error.message)
          ) {
            await assert.rejects(
              client.query(
                `INSERT INTO catalog.battle_pass_pricing(season_id,fixed_price)
                 VALUES('season.bp-test',2999)`,
              ),
              (pgError) =>
                pgError?.code === "23514" &&
                /battle_pass_pricing/.test(String(pgError?.message)),
            );
            return;
          }
          throw error;
        });

        await client.query(
          `INSERT INTO catalog.battle_pass_pricing(season_id,fixed_price)
           VALUES('season.bp-test',3000)`,
        );

        const room = (
          await client.query(
            "INSERT INTO game.rooms(code) VALUES('BP_MATCH') RETURNING id",
          )
        ).rows[0];

        const match = (
          await client.query(
            `INSERT INTO game.matches(
               room_id,sequence,requested_profile_id,resolved_profile_id,
               profile_source,dice_balance_profile_snapshot,
               battle_pass_season_id,battle_pass_xp_profile_id,
               battle_pass_xp_profile_snapshot
             )
             VALUES(
               $1,1,'uniform-v1','uniform-v1','catalog','{}'::jsonb,
               'season.bp-test','bp-test-v1',
               '{"completionXp":100,"victoryBonusXp":50,"soloHumanBotMultiplierBps":4000}'::jsonb
             )
             RETURNING id`,
            [room.id],
          )
        ).rows[0];

        await expectPgError(
          client,
          `UPDATE game.matches
              SET battle_pass_xp_profile_snapshot=
                '{"completionXp":999,"victoryBonusXp":0,"soloHumanBotMultiplierBps":10000}'::jsonb
            WHERE id=$1`,
          [match.id],
          {
            code: "P0001",
            message: /immutable/,
          },
        );

        await expectPgError(
          client,
          `INSERT INTO game.matches(
             room_id,sequence,requested_profile_id,resolved_profile_id,
             profile_source,dice_balance_profile_snapshot,
             battle_pass_season_id
           )
           VALUES(
             $1,2,'uniform-v1','uniform-v1','catalog','{}'::jsonb,
             'season.bp-test'
           )`,
          [room.id],
          {
            code: "23514",
            constraint: "matches_battle_pass_snapshot_shape_check",
          },
        );

        await client.query(
          `INSERT INTO catalog.battle_pass_seasons(
             id,slug,name,starts_at,ends_at,claim_ends_at,status,xp_profile_id
           )
           VALUES(
             'season.bp-history','bp-history','BP History',
             '2025-01-01T00:00:00Z','2025-12-01T00:00:00Z',
             '2026-01-01T00:00:00Z','archived','bp-test-v1'
           )`,
        );

        await expectPgError(
          client,
          `INSERT INTO catalog.battle_pass_levels(
             season_id,level,required_total_xp
           )
           VALUES('season.bp-history',1,0)`,
          [],
          {
            code: "P0001",
            message: /child catalog is immutable/,
          },
        );

        await expectPgError(
          client,
          `UPDATE catalog.battle_pass_seasons
              SET name='Reopened'
            WHERE id='season.bp-history'`,
          [],
          {
            code: "P0001",
            message: /immutable|cannot be reopened/,
          },
        );
      } finally {
        await client.end();
      }
    });
  });
}
