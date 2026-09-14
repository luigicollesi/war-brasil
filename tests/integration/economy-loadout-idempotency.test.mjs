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
  const name = `war_loadout_idempotency_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
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
  test("loadout idempotency exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("reequipar o mesmo cosmético não reescreve updated_at nem dinheiro", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const client = new Client({ connectionString });
      await client.connect();
      try {
        const user = await client.query(
          `INSERT INTO auth."user"(name,email,"emailVerified")
           VALUES('Idempotente',$1,TRUE)
           RETURNING id`,
          [`idempotent-${Date.now()}-${Math.random()}@example.invalid`],
        );
        const userId = user.rows[0].id;
        await client.query(
          `INSERT INTO profile.commanders(user_id,handle,display_name)
           VALUES($1,$2,'Idempotente')`,
          [userId, `idempotente_${Math.floor(Math.random() * 1_000_000)}`],
        );
        await client.query(
          `INSERT INTO economy.wallets(user_id,currency_code,balance)
           VALUES($1,'campaign-credit',0)`,
          [userId],
        );
        await client.query(
          `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
           VALUES($1,'dice.attack.default','dice_attack','default')`,
          [userId],
        );
        await client.query(
          `INSERT INTO profile.cosmetic_loadout(user_id,slot,cosmetic_id,updated_at)
           VALUES($1,'dice_attack','dice.attack.default','2000-01-01T00:00:00Z')`,
          [userId],
        );

        await client.query(
          `INSERT INTO profile.cosmetic_loadout AS current_loadout(
             user_id,slot,cosmetic_id,updated_at
           )
           VALUES($1,'dice_attack','dice.attack.default',NOW())
           ON CONFLICT (user_id,slot) DO UPDATE
           SET cosmetic_id=EXCLUDED.cosmetic_id,
               updated_at=NOW()
           WHERE current_loadout.cosmetic_id IS DISTINCT FROM EXCLUDED.cosmetic_id`,
          [userId],
        );

        const loadout = await client.query(
          `SELECT cosmetic_id,updated_at
             FROM profile.cosmetic_loadout
            WHERE user_id=$1 AND slot='dice_attack'`,
          [userId],
        );
        assert.equal(loadout.rows[0].cosmetic_id, "dice.attack.default");
        assert.equal(loadout.rows[0].updated_at.toISOString(), "2000-01-01T00:00:00.000Z");

        const wallet = await client.query(
          `SELECT balance::text AS balance
             FROM economy.wallets
            WHERE user_id=$1 AND currency_code='campaign-credit'`,
          [userId],
        );
        assert.equal(wallet.rows[0].balance, "0");

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
}
