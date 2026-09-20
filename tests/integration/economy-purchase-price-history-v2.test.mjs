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
  test("receipt mantém snapshots comerciais após alteração do catálogo atual", async () => {
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

        const product = await db.query(
          `SELECT offer.product_id,
                  product.bundle_discount_bps,
                  COUNT(membership.cosmetic_id)::int AS item_count,
                  SUM(pricing.fixed_price)::bigint::text AS subtotal
             FROM catalog.offers offer
             JOIN catalog.products product ON product.id=offer.product_id
             JOIN catalog.product_items membership ON membership.product_id=product.id
             JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=membership.cosmetic_id
            WHERE offer.id='offer.viking'
            GROUP BY offer.product_id,product.bundle_discount_bps`,
        );
        assert.equal(product.rowCount, 1);
        const subtotal = Number(product.rows[0].subtotal);
        const discountBps = product.rows[0].bundle_discount_bps;
        const pricePaid = Math.floor((subtotal * (10_000 - discountBps)) / 10_000);

        const purchaseId = randomUUID();
        await db.query(
          `INSERT INTO economy.purchases(
             id,user_id,offer_id,currency_code,price_paid,offer_item_count,idempotency_key,
             product_id,subtotal_price,discount_bps
           )
           VALUES(
             $1::uuid,$2::uuid,'offer.viking','campaign-credit',$3::bigint,$4::smallint,$5,
             $6,$7::bigint,$8::integer
           )`,
          [
            purchaseId,
            userId,
            pricePaid,
            product.rows[0].item_count,
            `price-${randomUUID()}`,
            product.rows[0].product_id,
            subtotal,
            discountBps,
          ],
        );

        await db.query(
          `INSERT INTO economy.purchase_items(purchase_id,cosmetic_id,unit_price)
           SELECT $1::uuid,membership.cosmetic_id,pricing.fixed_price
             FROM catalog.product_items membership
             JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=membership.cosmetic_id
            WHERE membership.product_id=$2`,
          [purchaseId, product.rows[0].product_id],
        );

        await db.query(
          `UPDATE catalog.cosmetic_pricing pricing
              SET fixed_price=fixed_price+300,
                  updated_at=NOW()
            WHERE pricing.cosmetic_id IN (
              SELECT membership.cosmetic_id
                FROM catalog.product_items membership
               WHERE membership.product_id=$1
            )`,
          [product.rows[0].product_id],
        );
        await db.query(
          `UPDATE catalog.products
              SET bundle_discount_bps=500,
                  updated_at=NOW()
            WHERE id=$1`,
          [product.rows[0].product_id],
        );

        const history = await db.query(
          `SELECT purchase.price_paid::text AS price_paid,
                  purchase.subtotal_price::text AS subtotal_price,
                  purchase.discount_bps,
                  MIN(item.unit_price)::text AS min_unit_price,
                  MIN(pricing.fixed_price)::text AS current_min_unit_price,
                  product.bundle_discount_bps AS current_discount_bps
             FROM economy.purchases purchase
             JOIN economy.purchase_items item ON item.purchase_id=purchase.id
             JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.cosmetic_id
             JOIN catalog.products product ON product.id=purchase.product_id
            WHERE purchase.id=$1::uuid
            GROUP BY purchase.id,product.bundle_discount_bps`,
          [purchaseId],
        );

        assert.deepEqual(history.rows[0], {
          price_paid: String(pricePaid),
          subtotal_price: String(subtotal),
          discount_bps: discountBps,
          min_unit_price: "500",
          current_min_unit_price: "800",
          current_discount_bps: 500,
        });
      } finally {
        await db.end();
      }
    });
  });
}
