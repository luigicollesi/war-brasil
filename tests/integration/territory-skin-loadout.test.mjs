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
  const name = `war_territory_skin_loadout_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
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

async function createCommander(client) {
  const user = await client.query(
    `INSERT INTO auth."user"(name,email,"emailVerified")
     VALUES('Territory Skin',$1,TRUE)
     RETURNING id`,
    [`territory-skin-${Date.now()}-${Math.random()}@example.invalid`],
  );
  const userId = user.rows[0].id;
  await client.query(
    `INSERT INTO profile.commanders(user_id,handle,display_name)
     VALUES($1,$2,'Territory Skin')`,
    [userId, `territory_skin_${Math.floor(Math.random() * 1_000_000)}`],
  );
  return userId;
}

if (!databaseUrl) {
  test("territory skin loadout exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("territory skin exige ownership, persiste equip e permite retornar ao default sem tocar economia", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const client = new Client({ connectionString });
      await client.connect();
      try {
        const userId = await createCommander(client);
        const imageSkinId = "territory.effect.azulejo-brasil";
        const defaultSkinId = "territory.effect.default";

        await client.query(
          `INSERT INTO economy.wallets(user_id,currency_code,balance)
           VALUES($1,'campaign-credit',0)`,
          [userId],
        );
        await client.query(
          `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
           VALUES($1,$2,'territory_effect','default')`,
          [userId, defaultSkinId],
        );
        await client.query(
          `INSERT INTO profile.cosmetic_loadout(user_id,slot,cosmetic_id)
           VALUES($1,'territory_effect',$2)`,
          [userId, defaultSkinId],
        );

        await assert.rejects(
          client.query(
            `UPDATE profile.cosmetic_loadout
                SET cosmetic_id=$2, updated_at=NOW()
              WHERE user_id=$1 AND slot='territory_effect'`,
            [userId, imageSkinId],
          ),
          (error) => error?.code === "23503",
          "loadout não pode apontar para territory skin que o usuário não possui",
        );

        await client.query(
          `UPDATE catalog.cosmetics SET status='available' WHERE id=$1`,
          [imageSkinId],
        );
        await client.query(
          `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
           VALUES($1,$2,'territory_effect','admin')`,
          [userId, imageSkinId],
        );
        await client.query(
          `UPDATE profile.cosmetic_loadout
              SET cosmetic_id=$2, updated_at=NOW()
            WHERE user_id=$1 AND slot='territory_effect'`,
          [userId, imageSkinId],
        );

        const equippedImage = await client.query(
          `SELECT cosmetic_id
             FROM profile.cosmetic_loadout
            WHERE user_id=$1 AND slot='territory_effect'`,
          [userId],
        );
        assert.equal(equippedImage.rows[0].cosmetic_id, imageSkinId);

        await client.query(
          `UPDATE profile.cosmetic_loadout
              SET cosmetic_id=$2, updated_at=NOW()
            WHERE user_id=$1 AND slot='territory_effect'`,
          [userId, defaultSkinId],
        );

        const finalLoadout = await client.query(
          `SELECT cosmetic_id
             FROM profile.cosmetic_loadout
            WHERE user_id=$1 AND slot='territory_effect'`,
          [userId],
        );
        assert.equal(finalLoadout.rows[0].cosmetic_id, defaultSkinId);

        const retainedOwnership = await client.query(
          `SELECT COUNT(*)::int AS total
             FROM inventory.cosmetics
            WHERE user_id=$1 AND cosmetic_id=$2`,
          [userId, imageSkinId],
        );
        assert.equal(retainedOwnership.rows[0].total, 1);

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
