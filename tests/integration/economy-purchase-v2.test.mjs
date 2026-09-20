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
  const name = `war_economy_purchase_${suffix}`;
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

async function createCommander(client, label) {
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
  return userId;
}

async function initializeEconomy(client, userId, balance) {
  await client.query(
    `INSERT INTO economy.wallets(user_id,currency_code,balance)
     VALUES($1::uuid,'campaign-credit',$2::bigint)
     ON CONFLICT (user_id,currency_code) DO UPDATE SET balance=EXCLUDED.balance`,
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
}

function rejected(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function integer(value) {
  const parsed = Number(value);
  assert.equal(Number.isSafeInteger(parsed), true);
  return parsed;
}

function calculateQuote(items, discountBps) {
  const missingItems = items.filter((item) => !item.owned);
  let subtotal = 0n;
  const unitPrices = new Map();

  for (const item of missingItems) {
    let unitPrice;
    if (item.pricing_model === "fixed") {
      unitPrice = integer(item.fixed_price);
    } else {
      assert.notEqual(item.tier_price, null);
      unitPrice = integer(item.tier_price);
    }
    unitPrices.set(item.id, unitPrice);
    subtotal += BigInt(unitPrice);
  }

  const finalPrice =
    (subtotal * BigInt(10_000 - discountBps)) / 10_000n;

  return {
    missingItems,
    unitPrices,
    subtotal: Number(subtotal),
    finalPrice: Number(finalPrice),
  };
}

async function purchaseInTransaction(
  client,
  userId,
  offerId,
  idempotencyKey,
  { expectedPrice = null, failAfterLedger = false } = {},
) {
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

    const walletResult = await client.query(
      `SELECT balance::text AS balance
         FROM economy.wallets
        WHERE user_id=$1::uuid
          AND currency_code='campaign-credit'
        FOR UPDATE`,
      [userId],
    );
    assert.equal(walletResult.rowCount, 1);

    const existing = await client.query(
      `SELECT id::text AS id,offer_id,price_paid::text AS price_paid
         FROM economy.purchases
        WHERE user_id=$1::uuid
          AND idempotency_key=$2`,
      [userId, idempotencyKey],
    );
    if (existing.rowCount === 1) {
      if (existing.rows[0].offer_id !== offerId) {
        throw rejected("ECONOMY_IDEMPOTENCY_CONFLICT");
      }
      await client.query("COMMIT");
      return {
        ok: true,
        replayed: true,
        purchaseId: existing.rows[0].id,
        price: integer(existing.rows[0].price_paid),
      };
    }

    const offerResult = await client.query(
      `SELECT offer.id,
              offer.product_id,
              offer.currency_code,
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
      throw rejected("ECONOMY_OFFER_UNAVAILABLE");
    }

    const offer = offerResult.rows[0];
    const lockedStats = await client.query(
      `SELECT stats.cosmetic_id
         FROM catalog.product_items membership
         JOIN catalog.cosmetic_stats stats ON stats.cosmetic_id=membership.cosmetic_id
        WHERE membership.product_id=$1
        ORDER BY stats.cosmetic_id
        FOR UPDATE OF stats`,
      [offer.product_id],
    );

    const items = await client.query(
      `SELECT item.id,
              item.slot,
              item.status,
              item.is_default,
              (owned.cosmetic_id IS NOT NULL) AS owned,
              pricing.pricing_model,
              pricing.fixed_price::text AS fixed_price,
              current_tier.price::text AS tier_price
         FROM catalog.product_items membership
         JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
         JOIN catalog.cosmetic_pricing pricing ON pricing.cosmetic_id=item.id
         JOIN catalog.cosmetic_stats stats ON stats.cosmetic_id=item.id
         LEFT JOIN inventory.cosmetics owned
           ON owned.user_id=$1::uuid
          AND owned.cosmetic_id=item.id
         LEFT JOIN LATERAL (
           SELECT tier.price
             FROM catalog.price_tiers tier
            WHERE tier.cosmetic_id=item.id
              AND stats.acquisition_count >= tier.acquisitions_from
              AND (
                tier.acquisitions_until IS NULL
                OR stats.acquisition_count <= tier.acquisitions_until
              )
            ORDER BY tier.acquisitions_from DESC
            LIMIT 1
         ) current_tier ON pricing.pricing_model='progressive'
        WHERE membership.product_id=$2
        ORDER BY membership.position,item.id
        FOR SHARE OF membership,item,pricing`,
      [userId, offer.product_id],
    );

    if (
      items.rowCount === 0 ||
      lockedStats.rowCount !== items.rowCount ||
      items.rows.some((item) => item.status !== "available" || item.is_default)
    ) {
      throw rejected("ECONOMY_CATALOG_INVALID");
    }

    const quote = calculateQuote(items.rows, offer.bundle_discount_bps);
    if (quote.missingItems.length === 0) {
      throw rejected("ECONOMY_OFFER_ALREADY_OWNED");
    }
    if (expectedPrice !== null && expectedPrice !== quote.finalPrice) {
      throw rejected("ECONOMY_PRICE_CHANGED", { currentPrice: quote.finalPrice });
    }

    const balance = integer(walletResult.rows[0].balance);
    if (balance < quote.finalPrice) {
      throw rejected("ECONOMY_INSUFFICIENT_BALANCE");
    }

    const purchaseId = randomUUID();
    await client.query(
      `INSERT INTO economy.purchases(
         id,user_id,offer_id,currency_code,price_paid,offer_item_count,idempotency_key,
         product_id,subtotal_price,discount_bps
       )
       VALUES(
         $1::uuid,$2::uuid,$3,'campaign-credit',$4::bigint,$5::smallint,$6,
         $7,$8::bigint,$9::integer
       )`,
      [
        purchaseId,
        userId,
        offerId,
        quote.finalPrice,
        items.rowCount,
        idempotencyKey,
        offer.product_id,
        quote.subtotal,
        offer.bundle_discount_bps,
      ],
    );

    let updatedBalance = balance;
    if (quote.finalPrice > 0) {
      const walletUpdate = await client.query(
        `UPDATE economy.wallets
            SET balance=balance-$2::bigint,
                updated_at=NOW()
          WHERE user_id=$1::uuid
            AND currency_code='campaign-credit'
            AND balance >= $2::bigint
          RETURNING balance::text AS balance`,
        [userId, quote.finalPrice],
      );
      if (walletUpdate.rowCount !== 1) throw rejected("ECONOMY_WALLET_CONFLICT");
      updatedBalance = integer(walletUpdate.rows[0].balance);

      await client.query(
        `INSERT INTO economy.ledger_entries(
           user_id,currency_code,delta,reason,domain_reference,idempotency_key
         )
         VALUES($1::uuid,'campaign-credit',-$3::bigint,'purchase',$2,'purchase:' || $2)`,
        [userId, purchaseId, quote.finalPrice],
      );
    }

    if (failAfterLedger) throw rejected("INJECTED_FAILURE");

    const cosmeticIds = quote.missingItems.map((item) => item.id);
    const slots = quote.missingItems.map((item) => item.slot);
    const granted = await client.query(
      `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
       SELECT $1::uuid,input.cosmetic_id,input.slot,'purchase'
         FROM UNNEST($2::text[],$3::varchar[]) AS input(cosmetic_id,slot)
       ON CONFLICT (user_id,cosmetic_id) DO NOTHING
       RETURNING cosmetic_id`,
      [userId, cosmeticIds, slots],
    );
    if (granted.rowCount !== quote.missingItems.length) {
      throw rejected("ECONOMY_INVENTORY_CONFLICT");
    }

    const grantedIds = granted.rows.map((row) => row.cosmetic_id).sort();
    await client.query(
      `UPDATE catalog.cosmetic_stats stats
          SET acquisition_count=acquisition_count+1,
              updated_at=NOW()
         FROM UNNEST($1::text[]) AS acquired(cosmetic_id)
        WHERE stats.cosmetic_id=acquired.cosmetic_id`,
      [grantedIds],
    );

    await client.query(
      `INSERT INTO economy.purchase_items(purchase_id,cosmetic_id,unit_price)
       SELECT $1::uuid,input.cosmetic_id,input.unit_price
         FROM UNNEST($2::text[],$3::bigint[]) AS input(cosmetic_id,unit_price)`,
      [
        purchaseId,
        grantedIds,
        grantedIds.map((id) => quote.unitPrices.get(id)),
      ],
    );

    await client.query("COMMIT");
    return {
      ok: true,
      replayed: false,
      purchaseId,
      price: quote.finalPrice,
      subtotal: quote.subtotal,
      discountBps: offer.bundle_discount_bps,
      balance: updatedBalance,
      grantedIds,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code?.startsWith?.("ECONOMY_") || error?.code === "INJECTED_FAILURE") {
      return {
        ok: false,
        code: error.code,
        ...(error.currentPrice === undefined ? {} : { currentPrice: error.currentPrice }),
      };
    }
    throw error;
  }
}

async function readMoneyState(client, userId) {
  const result = await client.query(
    `SELECT wallet.balance::text AS balance,
            (SELECT COUNT(*)::int FROM economy.purchases purchase WHERE purchase.user_id=wallet.user_id) AS purchases,
            (SELECT COUNT(*)::int FROM economy.ledger_entries ledger WHERE ledger.user_id=wallet.user_id) AS ledger_entries,
            COALESCE((SELECT SUM(ledger.delta)::text FROM economy.ledger_entries ledger WHERE ledger.user_id=wallet.user_id),'0') AS ledger_delta
       FROM economy.wallets wallet
      WHERE wallet.user_id=$1::uuid
        AND wallet.currency_code='campaign-credit'`,
    [userId],
  );
  assert.equal(result.rowCount, 1);
  return result.rows[0];
}

if (!databaseUrl) {
  test("economy purchase v2 exige DATABASE_URL", { skip: true }, () => {});
} else {
  test("retry concorrente com mesma idempotency key confirma uma única compra", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      const first = await connect(connectionString);
      const second = await connect(connectionString);
      try {
        const userId = await createCommander(setup, "PurchaseRetry");
        await initializeEconomy(setup, userId, 1500);
        const key = `retry-${randomUUID()}`;

        const [left, right] = await Promise.all([
          purchaseInTransaction(first, userId, "offer.viking", key, { expectedPrice: 1200 }),
          purchaseInTransaction(second, userId, "offer.viking", key, { expectedPrice: 1200 }),
        ]);

        assert.equal(left.ok, true);
        assert.equal(right.ok, true);
        assert.equal(left.purchaseId, right.purchaseId);
        assert.equal([left.replayed, right.replayed].filter(Boolean).length, 1);
        assert.deepEqual(await readMoneyState(setup, userId), {
          balance: "300",
          purchases: 1,
          ledger_entries: 1,
          ledger_delta: "-1200",
        });
      } finally {
        await Promise.all([setup.end(), first.end(), second.end()]);
      }
    });
  });

  test("saldo 500 com duas offers de 400 confirma no máximo uma compra", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      const first = await connect(connectionString);
      const second = await connect(connectionString);
      try {
        const userId = await createCommander(setup, "PurchaseRace");
        await initializeEconomy(setup, userId, 500);

        const results = await Promise.all([
          purchaseInTransaction(first, userId, "offer.exercito", `exercito-${randomUUID()}`, {
            expectedPrice: 400,
          }),
          purchaseInTransaction(second, userId, "offer.lancas", `lancas-${randomUUID()}`, {
            expectedPrice: 400,
          }),
        ]);

        assert.equal(results.filter((result) => result.ok).length, 1);
        assert.equal(
          results.filter((result) => result.code === "ECONOMY_INSUFFICIENT_BALANCE").length,
          1,
        );
        assert.deepEqual(await readMoneyState(setup, userId), {
          balance: "100",
          purchases: 1,
          ledger_entries: 1,
          ledger_delta: "-400",
        });
      } finally {
        await Promise.all([setup.end(), first.end(), second.end()]);
      }
    });
  });

  test("STORE-05: ownership parcial cobra somente itens ausentes com desconto", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      try {
        const userId = await createCommander(setup, "PartialOwnership");
        await initializeEconomy(setup, userId, 1000);

        const oneItem = await setup.query(
          `SELECT item.id,item.slot
             FROM catalog.offers offer
             JOIN catalog.product_items membership ON membership.product_id=offer.product_id
             JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
            WHERE offer.id='offer.viking'
            ORDER BY membership.position
            LIMIT 1`,
        );
        await setup.query(
          `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
           VALUES($1::uuid,$2,$3,'admin')`,
          [userId, oneItem.rows[0].id, oneItem.rows[0].slot],
        );

        const result = await purchaseInTransaction(
          setup,
          userId,
          "offer.viking",
          `partial-${randomUUID()}`,
          { expectedPrice: 800 },
        );
        assert.equal(result.ok, true);
        assert.equal(result.subtotal, 1000);
        assert.equal(result.price, 800);
        assert.equal(result.grantedIds.length, 2);
        assert.deepEqual(await readMoneyState(setup, userId), {
          balance: "200",
          purchases: 1,
          ledger_entries: 1,
          ledger_delta: "-800",
        });

        const receipt = await setup.query(
          `SELECT offer_item_count,
                  subtotal_price::text AS subtotal_price,
                  discount_bps,
                  price_paid::text AS price_paid
             FROM economy.purchases
            WHERE id=$1::uuid`,
          [result.purchaseId],
        );
        assert.deepEqual(receipt.rows[0], {
          offer_item_count: 3,
          subtotal_price: "1000",
          discount_bps: 2000,
          price_paid: "800",
        });
      } finally {
        await setup.end();
      }
    });
  });

  test("STORE-12: expectedPrice stale rejeita sem mutar wallet, ledger ou inventory", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      try {
        const userId = await createCommander(setup, "StalePrice");
        await initializeEconomy(setup, userId, 1000);
        const before = await setup.query(
          `SELECT COUNT(*)::int AS total FROM inventory.cosmetics WHERE user_id=$1::uuid`,
          [userId],
        );

        const result = await purchaseInTransaction(
          setup,
          userId,
          "offer.viking",
          `stale-${randomUUID()}`,
          { expectedPrice: 1199 },
        );
        assert.deepEqual(result, {
          ok: false,
          code: "ECONOMY_PRICE_CHANGED",
          currentPrice: 1200,
        });
        assert.deepEqual(await readMoneyState(setup, userId), {
          balance: "1000",
          purchases: 0,
          ledger_entries: 0,
          ledger_delta: "0",
        });

        const after = await setup.query(
          `SELECT COUNT(*)::int AS total FROM inventory.cosmetics WHERE user_id=$1::uuid`,
          [userId],
        );
        assert.equal(after.rows[0].total, before.rows[0].total);
      } finally {
        await setup.end();
      }
    });
  });

  test("falha após ledger faz rollback de wallet, receipt, ledger, counters e inventory", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      try {
        const userId = await createCommander(setup, "PurchaseRollback");
        await initializeEconomy(setup, userId, 500);
        const beforeInventory = await setup.query(
          `SELECT COUNT(*)::int AS total FROM inventory.cosmetics WHERE user_id=$1::uuid`,
          [userId],
        );
        const beforeStats = await setup.query(
          `SELECT SUM(stats.acquisition_count)::text AS total
             FROM catalog.cosmetic_stats stats`,
        );

        const result = await purchaseInTransaction(
          setup,
          userId,
          "offer.exercito",
          `rollback-${randomUUID()}`,
          { expectedPrice: 400, failAfterLedger: true },
        );
        assert.deepEqual(result, { ok: false, code: "INJECTED_FAILURE" });
        assert.deepEqual(await readMoneyState(setup, userId), {
          balance: "500",
          purchases: 0,
          ledger_entries: 0,
          ledger_delta: "0",
        });

        const afterInventory = await setup.query(
          `SELECT COUNT(*)::int AS total FROM inventory.cosmetics WHERE user_id=$1::uuid`,
          [userId],
        );
        const afterStats = await setup.query(
          `SELECT SUM(stats.acquisition_count)::text AS total
             FROM catalog.cosmetic_stats stats`,
        );
        assert.equal(afterInventory.rows[0].total, beforeInventory.rows[0].total);
        assert.equal(afterStats.rows[0].total, beforeStats.rows[0].total);
      } finally {
        await setup.end();
      }
    });
  });

  test("mesma idempotency key em usuários diferentes não compartilha autoridade", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      const first = await connect(connectionString);
      const second = await connect(connectionString);
      try {
        const userA = await createCommander(setup, "PurchaseUserA");
        const userB = await createCommander(setup, "PurchaseUserB");
        await initializeEconomy(setup, userA, 500);
        await initializeEconomy(setup, userB, 500);
        const sharedKey = `shared-${randomUUID()}`;

        const [purchaseA, purchaseB] = await Promise.all([
          purchaseInTransaction(first, userA, "offer.exercito", sharedKey, {
            expectedPrice: 400,
          }),
          purchaseInTransaction(second, userB, "offer.exercito", sharedKey, {
            expectedPrice: 400,
          }),
        ]);

        assert.equal(purchaseA.ok, true);
        assert.equal(purchaseB.ok, true);
        assert.notEqual(purchaseA.purchaseId, purchaseB.purchaseId);
        assert.equal((await readMoneyState(setup, userA)).balance, "100");
        assert.equal((await readMoneyState(setup, userB)).balance, "100");
      } finally {
        await Promise.all([setup.end(), first.end(), second.end()]);
      }
    });
  });
}
