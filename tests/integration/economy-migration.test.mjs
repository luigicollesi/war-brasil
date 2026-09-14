import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const economyMigrationSource = readFileSync(
  "src/lib/db/migrations/managed/038-economy-cosmetics-foundation.sql",
  "utf8",
);
const upMarker = "-- Up Migration";
const downMarker = "-- Down Migration";
const upStart = economyMigrationSource.indexOf(upMarker);
const downStart = economyMigrationSource.indexOf(downMarker, upStart + upMarker.length);
const economyMigrationSql = economyMigrationSource
  .slice(upStart + upMarker.length, downStart >= 0 ? downStart : economyMigrationSource.length)
  .trim();

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

if (!databaseUrl) {
  test("economy migration exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("038 cria moeda única, catálogo determinístico e backfill idempotente", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const client = new Client({ connectionString });
      await client.connect();

      try {
        assert.ok(upStart >= 0, "migration 038 precisa manter marcador -- Up Migration");
        assert.ok(economyMigrationSql.length > 0, "migration 038 precisa possuir SQL de up");

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
        assert.deepEqual(catalog.rows[0], { total: 13, defaults: 4, announced: 9 });

        const sets = await client.query(
          `SELECT cosmetic_set.id, cosmetic_set.status, COUNT(item.cosmetic_id)::int AS items
             FROM catalog.cosmetic_sets cosmetic_set
             LEFT JOIN catalog.cosmetic_set_items item ON item.set_id=cosmetic_set.id
            GROUP BY cosmetic_set.id,cosmetic_set.status
            ORDER BY cosmetic_set.id`,
        );
        assert.deepEqual(sets.rows, [
          { id: "set.exercito", status: "announced", items: 3 },
          { id: "set.lancas", status: "announced", items: 3 },
          { id: "set.viking", status: "announced", items: 3 },
        ]);

        const userId = await createCommander(client, "EconomyBackfill");

        // 038 já foi aplicada pelo runner. Executá-la novamente prova que o SQL é
        // idempotente e que o backfill também cobre comandantes preexistentes.
        await client.query(economyMigrationSql);
        await client.query(economyMigrationSql);

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

  test("038 bloqueia saldo negativo e loadout sem ownership/slot compatível", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const client = new Client({ connectionString });
      await client.connect();

      try {
        const userId = await createCommander(client, "EconomyConstraints");
        await client.query(economyMigrationSql);

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
      } finally {
        await client.end();
      }
    });
  });
}
