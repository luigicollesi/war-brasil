import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const preEconomyHistory = [
  "026-organize-database-schemas.sql",
  "027-normalize-schema-table-names.sql",
  "028-normalize-rooms-phase-constraint.sql",
  "029-adaptive-combat-dice.sql",
  "030-repair-adaptive-dice-state-schema.sql",
  "031-auth-foundation.sql",
  "032-profile-identity-game-binding.sql",
  "033-auth-rate-limit.sql",
  "034-profile-v3-foundation.sql",
  "035-social-graph.sql",
  "036-match-history-snapshots.sql",
  "037-profile-remove-portraits.sql",
];

function migrationUpSql(path) {
  const source = readFileSync(path, "utf8");
  const upMarker = "-- Up Migration";
  const downMarker = "-- Down Migration";
  const upStart = source.indexOf(upMarker);
  const downStart = source.indexOf(downMarker, upStart + upMarker.length);
  assert.ok(upStart >= 0, `${path} precisa manter marcador -- Up Migration`);
  return source
    .slice(upStart + upMarker.length, downStart >= 0 ? downStart : source.length)
    .trim();
}

function urlForDatabase(name) {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function withTemporaryDatabase(callback) {
  const suffix = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const name = `war_economy_${suffix}`;
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

async function prepareDatabaseThrough037(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(readFileSync("tests/fixtures/db/schema-v025.sql", "utf8"));
    await client.query(
      readFileSync("tests/fixtures/db/schema-v025-supplement.sql", "utf8"),
    );
    await client.query("CREATE SCHEMA IF NOT EXISTS ops");
    await client.query(`
      CREATE TABLE IF NOT EXISTS ops.pgmigrations (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        run_on TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const name of preEconomyHistory) {
      await client.query("BEGIN");
      try {
        await client.query(
          migrationUpSql(`src/lib/db/migrations/managed/${name}`),
        );
        await client.query("INSERT INTO ops.pgmigrations(name) VALUES($1)", [name]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

async function createCommander(client, label) {
  const user = await client.query(
    `INSERT INTO auth."user"(name,email,"emailVerified")
     VALUES($1,$2,TRUE)
     RETURNING id`,
    [label, `${label.toLowerCase()}-${Date.now()}-${Math.random()}@example.invalid`],
  );
  const userId = user.rows[0].id;
  await client.query(
    `INSERT INTO profile.commanders(user_id,handle,display_name)
     VALUES($1,$2,$3)`,
    [userId, `${label.toLowerCase()}_${Math.floor(Math.random() * 1_000_000)}`, label],
  );
  return userId;
}

async function createPreEconomyCommander(connectionString, label) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await createCommander(client, label);
  } finally {
    await client.end();
  }
}

if (!databaseUrl) {
  test("economy migration exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("038→040 converge catálogo dinâmico WebP e backfill idempotente", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabaseThrough037(connectionString);
      const userId = await createPreEconomyCommander(
        connectionString,
        "EconomyBackfill",
      );

      runPrepare(connectionString);
      runPrepare(connectionString);

      const client = new Client({ connectionString });
      await client.connect();
      try {
        const currencies = await client.query(
          `SELECT code,display_name,symbol,is_active
             FROM economy.currencies
            ORDER BY code`,
        );
        assert.deepEqual(currencies.rows, [
          {
            code: "campaign-credit",
            display_name: "Créditos de Campanha",
            symbol: "◈",
            is_active: true,
          },
        ]);

        const catalog = await client.query(
          `SELECT
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE is_default)::int AS defaults,
             COUNT(*) FILTER (WHERE status='announced')::int AS announced
             FROM catalog.cosmetics`,
        );
        assert.deepEqual(catalog.rows[0], {
          total: 22,
          defaults: 4,
          announced: 18,
        });

        const sets = await client.query(
          `SELECT cosmetic_set.id,
                  cosmetic_set.storage_slug,
                  cosmetic_set.status,
                  cosmetic_set.sort_order,
                  COUNT(item.cosmetic_id)::int AS items
             FROM catalog.cosmetic_sets cosmetic_set
             LEFT JOIN catalog.cosmetic_set_items item ON item.set_id=cosmetic_set.id
            GROUP BY cosmetic_set.id,cosmetic_set.storage_slug,cosmetic_set.status,cosmetic_set.sort_order
            ORDER BY cosmetic_set.sort_order,cosmetic_set.id`,
        );
        assert.deepEqual(sets.rows, [
          {
            id: "set.exercito",
            storage_slug: "military-classic",
            status: "announced",
            sort_order: 10,
            items: 3,
          },
          {
            id: "set.lancas",
            storage_slug: "medieval-spears",
            status: "announced",
            sort_order: 20,
            items: 3,
          },
          {
            id: "set.viking",
            storage_slug: "viking",
            status: "announced",
            sort_order: 30,
            items: 3,
          },
          {
            id: "set.gato",
            storage_slug: "cat",
            status: "announced",
            sort_order: 40,
            items: 3,
          },
          {
            id: "set.cachorro",
            storage_slug: "dog",
            status: "announced",
            sort_order: 50,
            items: 3,
          },
          {
            id: "set.futebol",
            storage_slug: "football",
            status: "announced",
            sort_order: 60,
            items: 3,
          },
        ]);

        const diceAssets = await client.query(
          `SELECT id,asset_ref
             FROM catalog.cosmetics
            WHERE slot IN ('dice_attack','dice_defense','dice_neutral')
            ORDER BY id`,
        );
        assert.equal(diceAssets.rowCount, 21);
        for (const row of diceAssets.rows) {
          assert.match(
            row.asset_ref,
            /^cosmetics\/dice\/[a-z0-9]+(?:-[a-z0-9]+)*\/(attack|defense|neutral)\.webp$/,
            row.id,
          );
        }

        const wallet = await client.query(
          `SELECT balance::text AS balance
             FROM economy.wallets
            WHERE user_id=$1 AND currency_code='campaign-credit'`,
          [userId],
        );
        assert.equal(wallet.rowCount, 1);
        assert.equal(wallet.rows[0].balance, "0");

        const inventory = await client.query(
          `SELECT COUNT(*)::int AS total
             FROM inventory.cosmetics
            WHERE user_id=$1`,
          [userId],
        );
        assert.equal(inventory.rows[0].total, 4);

        const loadout = await client.query(
          `SELECT slot,cosmetic_id
             FROM profile.cosmetic_loadout
            WHERE user_id=$1
            ORDER BY slot`,
          [userId],
        );
        assert.equal(loadout.rowCount, 4);
        assert.deepEqual(
          new Map(loadout.rows.map((row) => [row.slot, row.cosmetic_id])),
          new Map([
            ["dice_attack", "dice.attack.default"],
            ["dice_defense", "dice.defense.default"],
            ["dice_neutral", "dice.neutral.default"],
            ["territory_effect", "territory.effect.default"],
          ]),
        );

        const ledger = await client.query(
          `SELECT COUNT(*)::int AS total
             FROM economy.ledger_entries
            WHERE user_id=$1`,
          [userId],
        );
        assert.equal(ledger.rows[0].total, 0);
      } finally {
        await client.end();
      }
    });
  });

  test("constraints bloqueiam saldo negativo, loadout inválido e dado não-WebP", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabaseThrough037(connectionString);
      const userId = await createPreEconomyCommander(
        connectionString,
        "EconomyConstraints",
      );
      runPrepare(connectionString);

      const client = new Client({ connectionString });
      await client.connect();
      try {
        await assert.rejects(
          client.query(
            `UPDATE economy.wallets
                SET balance=-1
              WHERE user_id=$1 AND currency_code='campaign-credit'`,
            [userId],
          ),
          (error) => error?.code === "23514",
        );

        await assert.rejects(
          client.query(
            `UPDATE profile.cosmetic_loadout
                SET cosmetic_id='dice.attack.exercito'
              WHERE user_id=$1 AND slot='dice_attack'`,
            [userId],
          ),
          (error) => error?.code === "23503",
        );

        await assert.rejects(
          client.query(
            `UPDATE profile.cosmetic_loadout
                SET cosmetic_id='dice.attack.default'
              WHERE user_id=$1 AND slot='dice_defense'`,
            [userId],
          ),
          (error) => error?.code === "23503",
        );

        await assert.rejects(
          client.query(
            `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
             VALUES($1,'dice.attack.exercito','dice_defense','default')`,
            [userId],
          ),
          (error) => error?.code === "23503",
        );

        await assert.rejects(
          client.query(
            `UPDATE catalog.cosmetics
                SET asset_ref='/dados/exercito/ataque.svg'
              WHERE id='dice.attack.exercito'`,
          ),
          (error) => error?.code === "23514",
        );
      } finally {
        await client.end();
      }
    });
  });
}
