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
  const name = `war_economy_read_${suffix}`;
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

async function connect(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

async function lockCommander(client, userId) {
  await client.query(
    `SELECT user_id
       FROM profile.commanders
      WHERE user_id=$1::uuid
      FOR UPDATE`,
    [userId],
  );
}

async function initializeCommander(client) {
  const user = await client.query(
    `INSERT INTO auth."user"(name,email,"emailVerified")
     VALUES('Read Race',$1,TRUE)
     RETURNING id`,
    [`read-race-${Date.now()}-${Math.random()}@example.invalid`],
  );
  const userId = user.rows[0].id;
  await client.query(
    `INSERT INTO profile.commanders(user_id,handle,display_name)
     VALUES($1,$2,'Read Race')`,
    [userId, `read_race_${Math.floor(Math.random() * 1_000_000)}`],
  );

  await client.query("BEGIN");
  try {
    await lockCommander(client, userId);
    await client.query(
      `INSERT INTO economy.wallets(user_id,currency_code,balance)
       VALUES($1,'campaign-credit',0)
       ON CONFLICT DO NOTHING`,
      [userId],
    );
    await client.query(
      `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
       SELECT $1,item.id,item.slot,'default'
         FROM catalog.cosmetics item
        WHERE item.is_default=TRUE
       ON CONFLICT DO NOTHING`,
      [userId],
    );
    await client.query(
      `INSERT INTO profile.cosmetic_loadout(user_id,slot,cosmetic_id)
       SELECT $1,item.slot,item.id
         FROM catalog.cosmetics item
        WHERE item.is_default=TRUE
       ON CONFLICT (user_id,slot) DO NOTHING`,
      [userId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  await client.query(
    `UPDATE catalog.cosmetics
        SET status='available'
      WHERE id='dice.attack.exercito'`,
  );
  await client.query(
    `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
     VALUES($1,'dice.attack.exercito','dice_attack','admin')`,
    [userId],
  );
  return userId;
}

if (!databaseUrl) {
  test("economy read concurrency exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("leitura concorrente espera equipagem e observa um loadout completo", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      const equip = await connect(connectionString);
      const reader = await connect(connectionString);

      try {
        const userId = await initializeCommander(setup);

        await equip.query("BEGIN");
        await lockCommander(equip, userId);
        await equip.query(
          `UPDATE profile.cosmetic_loadout
              SET cosmetic_id='dice.attack.exercito',updated_at=NOW()
            WHERE user_id=$1 AND slot='dice_attack'`,
          [userId],
        );

        const readAfterEquip = (async () => {
          await reader.query("BEGIN");
          try {
            await lockCommander(reader, userId);
            const rows = await reader.query(
              `SELECT slot,cosmetic_id
                 FROM profile.cosmetic_loadout
                WHERE user_id=$1
                ORDER BY slot`,
              [userId],
            );
            const wallet = await reader.query(
              `SELECT balance::text AS balance
                 FROM economy.wallets
                WHERE user_id=$1 AND currency_code='campaign-credit'`,
              [userId],
            );
            await reader.query("COMMIT");
            return { rows: rows.rows, balance: wallet.rows[0].balance };
          } catch (error) {
            await reader.query("ROLLBACK");
            throw error;
          }
        })();

        await equip.query("COMMIT");
        const snapshot = await readAfterEquip;
        const bySlot = new Map(snapshot.rows.map((row) => [row.slot, row.cosmetic_id]));

        assert.equal(bySlot.size, 4);
        assert.equal(bySlot.get("dice_attack"), "dice.attack.exercito");
        assert.equal(bySlot.get("dice_defense"), "dice.defense.default");
        assert.equal(bySlot.get("dice_neutral"), "dice.neutral.default");
        assert.equal(bySlot.get("territory_effect"), "territory.effect.default");
        assert.equal(snapshot.balance, "0");

        const ledger = await setup.query(
          `SELECT COUNT(*)::int AS total
             FROM economy.ledger_entries
            WHERE user_id=$1`,
          [userId],
        );
        assert.equal(ledger.rows[0].total, 0);
      } finally {
        await Promise.all([setup.end(), equip.end(), reader.end()]);
      }
    });
  });
}
