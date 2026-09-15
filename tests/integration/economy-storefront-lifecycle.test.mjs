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
  const name = `war_store_lifecycle_${suffix}`;
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

async function connect(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

async function createCommander(client, label, balance = 2000) {
  const user = await client.query(
    `INSERT INTO auth."user"(name,email,"emailVerified")
     VALUES($1,$2,TRUE)
     RETURNING id`,
    [label, `${label.toLowerCase()}-${randomUUID()}@example.invalid`],
  );
  const userId = user.rows[0].id;
  await client.query(
    `INSERT INTO profile.commanders(user_id,handle,display_name)
     VALUES($1,$2,$3)`,
    [userId, `${label.toLowerCase()}_${randomUUID().slice(0, 8)}`, label],
  );
  await client.query(
    `INSERT INTO economy.wallets(user_id,currency_code,balance)
     VALUES($1::uuid,'campaign-credit',$2::bigint)`,
    [userId, balance],
  );
  await client.query(
    `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
     SELECT $1::uuid,item.id,item.slot,'default'
       FROM catalog.cosmetics item
      WHERE item.is_default=TRUE
     ON CONFLICT (user_id,cosmetic_id) DO NOTHING`,
    [userId],
  );
  await client.query(
    `INSERT INTO profile.cosmetic_loadout(user_id,slot,cosmetic_id)
     SELECT $1::uuid,item.slot,item.id
       FROM catalog.cosmetics item
      WHERE item.is_default=TRUE
     ON CONFLICT (user_id,slot) DO NOTHING`,
    [userId],
  );
  return userId;
}

function integer(value) {
  const parsed = Number(value);
  assert.equal(Number.isSafeInteger(parsed), true);
  return parsed;
}

async function purchaseSingleOffer(client, userId, offerId, expectedPrice) {
  await client.query("BEGIN");
  try {
    const commander = await client.query(
      `SELECT user_id
         FROM profile.commanders
        WHERE user_id=$1::uuid
        FOR UPDATE`,
      [userId],
    );
    assert.equal(commander.rowCount, 1);

    const wallet = await client.query(
      `SELECT balance::text AS balance
         FROM economy.wallets
        WHERE user_id=$1::uuid AND currency_code='campaign-credit'
        FOR UPDATE`,
      [userId],
    );
    assert.equal(wallet.rowCount, 1);

    const offerResult = await client.query(
      `SELECT offer.id,
              offer.product_id,
              product.bundle_discount_bps,
              (
                offer.status='available'
                AND offer.active=TRUE
                AND product.active=TRUE
                AND (offer.starts_at IS NULL OR offer.starts_at <= CURRENT_TIMESTAMP)
                AND (offer.ends_at IS NULL OR offer.ends_at > CURRENT_TIMESTAMP)
              ) AS available_now
         FROM catalog.offers offer
         JOIN catalog.products product ON product.id=offer.product_id
        WHERE offer.id=$1
        FOR UPDATE OF offer,product`,
      [offerId],
    );
    if (offerResult.rowCount !== 1 || !offerResult.rows[0].available_now) {
      await client.query("ROLLBACK");
      return { ok: false, code: "ECONOMY_OFFER_UNAVAILABLE" };
    }

    const offer = offerResult.rows[0];
    const stats = await client.query(
      `SELECT stats.cosmetic_id,stats.acquisition_count::text AS acquisition_count
         FROM catalog.product_items membership
         JOIN catalog.cosmetic_stats stats ON stats.cosmetic_id=membership.cosmetic_id
        WHERE membership.product_id=$1
        ORDER BY stats.cosmetic_id
        FOR UPDATE OF stats`,
      [offer.product_id],
    );
    assert.equal(stats.rowCount, 1, "helper is intentionally limited to single products");

    const item = await client.query(
      `SELECT cosmetic.id,
              cosmetic.slot,
              cosmetic.status,
              cosmetic.is_default,
              (owned.cosmetic_id IS NOT NULL) AS owned,
              pricing.pricing_model,
              pricing.fixed_price::text AS fixed_price,
              tier.price::text AS tier_price
         FROM catalog.product_items membership
         JOIN catalog.cosmetics cosmetic ON cosmetic.id=membership.cosmetic_id
         JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=cosmetic.id
         JOIN catalog.cosmetic_stats stats ON stats.cosmetic_id=cosmetic.id
         LEFT JOIN inventory.cosmetics owned
           ON owned.user_id=$1::uuid AND owned.cosmetic_id=cosmetic.id
         LEFT JOIN LATERAL (
           SELECT price
             FROM catalog.price_tiers price_tier
            WHERE price_tier.cosmetic_id=cosmetic.id
              AND stats.acquisition_count >= price_tier.acquisitions_from
              AND (
                price_tier.acquisitions_until IS NULL
                OR stats.acquisition_count <= price_tier.acquisitions_until
              )
            ORDER BY price_tier.acquisitions_from DESC
            LIMIT 1
         ) tier ON pricing.pricing_model='progressive'
        WHERE membership.product_id=$2
        FOR SHARE OF membership,cosmetic,pricing`,
      [userId, offer.product_id],
    );
    assert.equal(item.rowCount, 1);
    const row = item.rows[0];
    if (row.status !== "available" || row.is_default) {
      throw new Error("invalid catalogue fixture");
    }
    if (row.owned) {
      await client.query("ROLLBACK");
      return { ok: false, code: "ECONOMY_OFFER_ALREADY_OWNED" };
    }

    const currentPrice = integer(
      row.pricing_model === "fixed" ? row.fixed_price : row.tier_price,
    );
    if (currentPrice !== expectedPrice) {
      await client.query("ROLLBACK");
      return { ok: false, code: "ECONOMY_PRICE_CHANGED", currentPrice };
    }
    if (integer(wallet.rows[0].balance) < currentPrice) {
      await client.query("ROLLBACK");
      return { ok: false, code: "ECONOMY_INSUFFICIENT_BALANCE" };
    }

    const purchaseId = randomUUID();
    await client.query(
      `INSERT INTO economy.purchases(
         id,user_id,offer_id,currency_code,price_paid,offer_item_count,idempotency_key,
         product_id,subtotal_price,discount_bps
       ) VALUES(
         $1::uuid,$2::uuid,$3,'campaign-credit',$4::bigint,1,$5,
         $6,$4::bigint,0
       )`,
      [purchaseId, userId, offerId, currentPrice, randomUUID(), offer.product_id],
    );
    await client.query(
      `UPDATE economy.wallets
          SET balance=balance-$2::bigint,updated_at=NOW()
        WHERE user_id=$1::uuid AND currency_code='campaign-credit'`,
      [userId, currentPrice],
    );
    await client.query(
      `INSERT INTO economy.ledger_entries(
         user_id,currency_code,delta,reason,domain_reference,idempotency_key
       ) VALUES(
         $1::uuid,'campaign-credit',-$3::bigint,'purchase',$2,'purchase:' || $2
       )`,
      [userId, purchaseId, currentPrice],
    );
    const granted = await client.query(
      `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
       VALUES($1::uuid,$2,$3,'purchase')
       ON CONFLICT (user_id,cosmetic_id) DO NOTHING
       RETURNING cosmetic_id`,
      [userId, row.id, row.slot],
    );
    assert.equal(granted.rowCount, 1);
    await client.query(
      `UPDATE catalog.cosmetic_stats
          SET acquisition_count=acquisition_count+1,updated_at=NOW()
        WHERE cosmetic_id=$1`,
      [row.id],
    );
    await client.query(
      `INSERT INTO economy.purchase_items(purchase_id,cosmetic_id,unit_price)
       VALUES($1::uuid,$2,$3::bigint)`,
      [purchaseId, row.id, currentPrice],
    );
    await client.query("COMMIT");
    return { ok: true, purchaseId, cosmeticId: row.id, price: currentPrice };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

if (!databaseUrl) {
  test("storefront lifecycle integration exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("STORE-13/14: corrida 99→100 serializa tier e força nova confirmação", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      const first = await connect(connectionString);
      const second = await connect(connectionString);
      try {
        const userA = await createCommander(setup, "TierUserA");
        const userB = await createCommander(setup, "TierUserB");
        const cosmeticId = "dice.attack.exercito";
        const offerId = "offer.single.dice.attack.exercito";

        await setup.query(
          `UPDATE catalog.cosmetic_pricing
              SET pricing_model='progressive',fixed_price=NULL,updated_at=NOW()
            WHERE cosmetic_id=$1`,
          [cosmeticId],
        );
        await setup.query(`DELETE FROM catalog.price_tiers WHERE cosmetic_id=$1`, [cosmeticId]);
        await setup.query(
          `INSERT INTO catalog.price_tiers(
             cosmetic_id,acquisitions_from,acquisitions_until,price
           ) VALUES($1,0,99,500),($1,100,NULL,575)`,
          [cosmeticId],
        );
        await setup.query(
          `UPDATE catalog.cosmetic_stats
              SET acquisition_count=99,updated_at=NOW()
            WHERE cosmetic_id=$1`,
          [cosmeticId],
        );

        const results = await Promise.all([
          purchaseSingleOffer(first, userA, offerId, 500),
          purchaseSingleOffer(second, userB, offerId, 500),
        ]);
        assert.equal(results.filter((result) => result.ok).length, 1);
        const stale = results.find((result) => !result.ok);
        assert.deepEqual(stale, {
          ok: false,
          code: "ECONOMY_PRICE_CHANGED",
          currentPrice: 575,
        });

        const counterAtBoundary = await setup.query(
          `SELECT acquisition_count::text AS count
             FROM catalog.cosmetic_stats
            WHERE cosmetic_id=$1`,
          [cosmeticId],
        );
        assert.equal(counterAtBoundary.rows[0].count, "100");

        const staleUser = results[0].ok ? userB : userA;
        const retryClient = results[0].ok ? second : first;
        const retry = await purchaseSingleOffer(retryClient, staleUser, offerId, 575);
        assert.equal(retry.ok, true);
        assert.equal(retry.price, 575);

        const finalCounter = await setup.query(
          `SELECT acquisition_count::text AS count
             FROM catalog.cosmetic_stats
            WHERE cosmetic_id=$1`,
          [cosmeticId],
        );
        assert.equal(finalCounter.rows[0].count, "101");
      } finally {
        await Promise.all([setup.end(), first.end(), second.end()]);
      }
    });
  });

  test("STORE-15: scheduled, active, expired e disabled são decididos pelo servidor", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const db = await connect(connectionString);
      try {
        const offerId = "offer.single.dice.attack.exercito";

        const scheduledUser = await createCommander(db, "ScheduledOffer");
        await db.query(
          `UPDATE catalog.offers
              SET starts_at=CURRENT_TIMESTAMP + INTERVAL '1 hour',
                  ends_at=CURRENT_TIMESTAMP + INTERVAL '2 hours',active=TRUE
            WHERE id=$1`,
          [offerId],
        );
        assert.deepEqual(
          await purchaseSingleOffer(db, scheduledUser, offerId, 150),
          { ok: false, code: "ECONOMY_OFFER_UNAVAILABLE" },
        );

        const activeUser = await createCommander(db, "ActiveOffer");
        await db.query(
          `UPDATE catalog.offers
              SET starts_at=CURRENT_TIMESTAMP - INTERVAL '1 hour',
                  ends_at=CURRENT_TIMESTAMP + INTERVAL '1 hour',active=TRUE
            WHERE id=$1`,
          [offerId],
        );
        assert.equal((await purchaseSingleOffer(db, activeUser, offerId, 150)).ok, true);

        const expiredUser = await createCommander(db, "ExpiredOffer");
        await db.query(
          `UPDATE catalog.offers
              SET starts_at=CURRENT_TIMESTAMP - INTERVAL '2 hours',
                  ends_at=CURRENT_TIMESTAMP - INTERVAL '1 second',active=TRUE
            WHERE id=$1`,
          [offerId],
        );
        assert.deepEqual(
          await purchaseSingleOffer(db, expiredUser, offerId, 150),
          { ok: false, code: "ECONOMY_OFFER_UNAVAILABLE" },
        );

        const boundaryUser = await createCommander(db, "BoundaryOffer");
        await db.query(
          `UPDATE catalog.offers
              SET starts_at=CURRENT_TIMESTAMP - INTERVAL '1 hour',
                  ends_at=CURRENT_TIMESTAMP,active=TRUE
            WHERE id=$1`,
          [offerId],
        );
        assert.deepEqual(
          await purchaseSingleOffer(db, boundaryUser, offerId, 150),
          { ok: false, code: "ECONOMY_OFFER_UNAVAILABLE" },
        );

        const disabledUser = await createCommander(db, "DisabledOffer");
        await db.query(
          `UPDATE catalog.offers
              SET starts_at=NULL,ends_at=NULL,active=FALSE
            WHERE id=$1`,
          [offerId],
        );
        assert.deepEqual(
          await purchaseSingleOffer(db, disabledUser, offerId, 150),
          { ok: false, code: "ECONOMY_OFFER_UNAVAILABLE" },
        );
      } finally {
        await db.end();
      }
    });
  });

  test("STORE-02/24: territory skin usa o mesmo purchase pipeline atômico", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const db = await connect(connectionString);
      try {
        const userId = await createCommander(db, "TerritoryBuyer", 500);
        const offerId = "offer.single.territory.effect.azulejo-brasil";
        const result = await purchaseSingleOffer(db, userId, offerId, 300);
        assert.equal(result.ok, true);
        assert.equal(result.cosmeticId, "territory.effect.azulejo-brasil");

        const state = await db.query(
          `SELECT wallet.balance::text AS balance,
                  owned.slot,
                  owned.acquisition_source,
                  purchase.price_paid::text AS paid,
                  purchase_item.unit_price::text AS unit_price
             FROM economy.wallets wallet
             JOIN inventory.cosmetics owned
               ON owned.user_id=wallet.user_id
              AND owned.cosmetic_id='territory.effect.azulejo-brasil'
             JOIN economy.purchases purchase
               ON purchase.user_id=wallet.user_id
              AND purchase.id=$2::uuid
             JOIN economy.purchase_items purchase_item
               ON purchase_item.purchase_id=purchase.id
              AND purchase_item.cosmetic_id=owned.cosmetic_id
            WHERE wallet.user_id=$1::uuid
              AND wallet.currency_code='campaign-credit'`,
          [userId, result.purchaseId],
        );
        assert.deepEqual(state.rows, [
          {
            balance: "200",
            slot: "territory_skin",
            acquisition_source: "purchase",
            paid: "300",
            unit_price: "300",
          },
        ]);
      } finally {
        await db.end();
      }
    });
  });
}
