import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  const name = `war_economy_price_history_${suffix}`;
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

if (!databaseUrl) {
  test("economy purchase price history exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("receipt mantém price_paid após alteração do preço atual da offer", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const db = new Client({ connectionString });
      await db.connect();
      try {
        const user = await db.query(
          `INSERT INTO auth."user"(name,email,"emailVerified")
           VALUES('Price History',$1,TRUE)
           RETURNING id`,
          [`price-history-${randomUUID()}@example.invalid`],
        );
        const userId = user.rows[0].id;

        await db.query(
          `INSERT INTO economy.wallets(user_id,currency_code,balance)
           VALUES($1::uuid,'campaign-credit',1000)`,
          [userId],
        );

        const offer = await db.query(
          `SELECT price::text AS price,
                  (SELECT COUNT(*)::int FROM catalog.offer_items membership WHERE membership.offer_id=offer.id) AS item_count
             FROM catalog.offers offer
            WHERE id='offer.viking'`,
        );
        assert.equal(offer.rowCount, 1);
        const originalPrice = Number(offer.rows[0].price);
        assert.ok(originalPrice > 0);
        assert.ok(offer.rows[0].item_count > 0);

        const purchaseId = randomUUID();
        await db.query(
          `INSERT INTO economy.purchases(
             id,user_id,offer_id,currency_code,price_paid,offer_item_count,idempotency_key
           )
           VALUES($1::uuid,$2::uuid,'offer.viking','campaign-credit',$3::bigint,$4::smallint,$5)`,
          [purchaseId, userId, originalPrice, offer.rows[0].item_count, `price-${randomUUID()}`],
        );

        const newPrice = originalPrice + 300;
        await db.query(
          `UPDATE catalog.offers SET price=$2::bigint WHERE id=$1`,
          ["offer.viking", newPrice],
        );

        const history = await db.query(
          `SELECT purchase.price_paid::text AS price_paid,
                  offer.price::text AS current_price
             FROM economy.purchases purchase
             JOIN catalog.offers offer ON offer.id=purchase.offer_id
            WHERE purchase.id=$1::uuid`,
          [purchaseId],
        );

        assert.deepEqual(history.rows[0], {
          price_paid: String(originalPrice),
          current_price: String(newPrice),
        });
      } finally {
        await db.end();
      }
    });
  });
}
