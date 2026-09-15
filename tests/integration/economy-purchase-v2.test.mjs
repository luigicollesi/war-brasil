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

function rejected(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function purchaseInTransaction(
  client,
  userId,
  offerId,
  idempotencyKey,
  { failAfterLedger = false } = {},
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
        price: Number(existing.rows[0].price_paid),
      };
    }

    const offerResult = await client.query(
      `SELECT id,price::text AS price,status,currency_code
         FROM catalog.offers
        WHERE id=$1
        FOR SHARE`,
      [offerId],
    );
    if (offerResult.rowCount !== 1 || offerResult.rows[0].status !== "available") {
      throw rejected("ECONOMY_OFFER_UNAVAILABLE");
    }

    const items = await client.query(
      `SELECT item.id,item.slot,item.status,item.is_default,
              (owned.cosmetic_id IS NOT NULL) AS owned
         FROM catalog.offer_items membership
         JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
         LEFT JOIN inventory.cosmetics owned
           ON owned.user_id=$1::uuid
          AND owned.cosmetic_id=item.id
        WHERE membership.offer_id=$2
        ORDER BY membership.position,item.id
        FOR SHARE OF membership,item`,
      [userId, offerId],
    );
    if (
      items.rowCount === 0 ||
      items.rows.some((item) => item.status !== "available" || item.is_default)
    ) {
      throw rejected("ECONOMY_CATALOG_INVALID");
    }

    const missingItems = items.rows.filter((item) => !item.owned);
    if (missingItems.length === 0) {
      throw rejected("ECONOMY_OFFER_ALREADY_OWNED");
    }

    const price = Number(offerResult.rows[0].price);
    const balance = Number(walletResult.rows[0].balance);
    if (balance < price) throw rejected("ECONOMY_INSUFFICIENT_BALANCE");

    const purchaseId = randomUUID();
    await client.query(
      `INSERT INTO economy.purchases(
         id,user_id,offer_id,currency_code,price_paid,offer_item_count,idempotency_key
       )
       VALUES($1::uuid,$2::uuid,$3,'campaign-credit',$4::bigint,$5::smallint,$6)`,
      [purchaseId, userId, offerId, price, items.rowCount, idempotencyKey],
    );

    const walletUpdate = await client.query(
      `UPDATE economy.wallets
          SET balance=balance-$2::bigint,
              updated_at=NOW()
        WHERE user_id=$1::uuid
          AND currency_code='campaign-credit'
          AND balance >= $2::bigint
        RETURNING balance::text AS balance`,
      [userId, price],
    );
    if (walletUpdate.rowCount !== 1) throw rejected("ECONOMY_WALLET_CONFLICT");

    await client.query(
      `INSERT INTO economy.ledger_entries(
         user_id,currency_code,delta,reason,domain_reference,idempotency_key
       )
       VALUES($1::uuid,'campaign-credit',-$3::bigint,'purchase',$2,'purchase:' || $2)`,
      [userId, purchaseId, price],
    );

    if (failAfterLedger) throw rejected("INJECTED_FAILURE");

    const cosmeticIds = missingItems.map((item) => item.id);
    const slots = missingItems.map((item) => item.slot);
    const granted = await client.query(
      `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
       SELECT $1::uuid,input.cosmetic_id,input.slot,'purchase'
         FROM UNNEST($2::text[],$3::varchar[]) AS input(cosmetic_id,slot)
       ON CONFLICT (user_id,cosmetic_id) DO NOTHING
       RETURNING cosmetic_id`,
      [userId, cosmeticIds, slots],
    );
    if (granted.rowCount !== missingItems.length) {
      throw rejected("ECONOMY_INVENTORY_CONFLICT");
    }

    await client.query(
      `INSERT INTO economy.purchase_items(purchase_id,cosmetic_id)
       SELECT $1::uuid,cosmetic_id
         FROM UNNEST($2::text[]) AS granted(cosmetic_id)`,
      [purchaseId, granted.rows.map((row) => row.cosmetic_id)],
    );

    await client.query("COMMIT");
    return {
      ok: true,
      replayed: false,
      purchaseId,
      price,
      balance: Number(walletUpdate.rows[0].balance),
      grantedIds: granted.rows.map((row) => row.cosmetic_id).sort(),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code?.startsWith?.("ECONOMY_") || error?.code === "INJECTED_FAILURE") {
      return { ok: false, code: error.code };
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
        await initializeEconomy(setup, userId, 1000);
        const key = `retry-${randomUUID()}`;

        const [left, right] = await Promise.all([
          purchaseInTransaction(first, userId, "offer.viking", key),
          purchaseInTransaction(second, userId, "offer.viking", key),
        ]);

        assert.equal(left.ok, true);
        assert.equal(right.ok, true);
        assert.equal(left.purchaseId, right.purchaseId);
        assert.equal([left.replayed, right.replayed].filter(Boolean).length, 1);
        assert.deepEqual(await readMoneyState(setup, userId), {
          balance: "600",
          purchases: 1,
          ledger_entries: 1,
          ledger_delta: "-400",
        });

        const purchaseItems = await setup.query(
          `SELECT COUNT(*)::int AS total
             FROM economy.purchase_items
            WHERE purchase_id=$1::uuid`,
          [left.purchaseId],
        );
        assert.equal(purchaseItems.rows[0].total, 3);
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
          purchaseInTransaction(first, userId, "offer.gato", `gato-${randomUUID()}`),
          purchaseInTransaction(second, userId, "offer.cachorro", `dog-${randomUUID()}`),
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

  test("ownership parcial cobra preço integral e concede somente itens ausentes", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      try {
        const userId = await createCommander(setup, "PartialOwnership");
        await initializeEconomy(setup, userId, 500);

        const oneItem = await setup.query(
          `SELECT item.id,item.slot
             FROM catalog.offer_items membership
             JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
            WHERE membership.offer_id='offer.viking'
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
        );
        assert.equal(result.ok, true);
        assert.equal(result.price, 400);
        assert.equal(result.grantedIds.length, 2);
        assert.deepEqual(await readMoneyState(setup, userId), {
          balance: "100",
          purchases: 1,
          ledger_entries: 1,
          ledger_delta: "-400",
        });

        const receipt = await setup.query(
          `SELECT offer_item_count,price_paid::text AS price_paid
             FROM economy.purchases
            WHERE id=$1::uuid`,
          [result.purchaseId],
        );
        assert.deepEqual(receipt.rows[0], { offer_item_count: 3, price_paid: "400" });

        const purchaseItems = await setup.query(
          `SELECT COUNT(*)::int AS total FROM economy.purchase_items WHERE purchase_id=$1::uuid`,
          [result.purchaseId],
        );
        assert.equal(purchaseItems.rows[0].total, 2);
      } finally {
        await setup.end();
      }
    });
  });

  test("falha após ledger faz rollback de wallet, receipt, ledger e inventory", async () => {
    await withTemporaryDatabase(async (connectionString) => {
      await prepareDatabase(connectionString);
      const setup = await connect(connectionString);
      try {
        const userId = await createCommander(setup, "PurchaseRollback");
        await initializeEconomy(setup, userId, 500);
        const before = await setup.query(
          `SELECT COUNT(*)::int AS total FROM inventory.cosmetics WHERE user_id=$1::uuid`,
          [userId],
        );

        const result = await purchaseInTransaction(
          setup,
          userId,
          "offer.futebol",
          `rollback-${randomUUID()}`,
          { failAfterLedger: true },
        );
        assert.deepEqual(result, { ok: false, code: "INJECTED_FAILURE" });
        assert.deepEqual(await readMoneyState(setup, userId), {
          balance: "500",
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
          purchaseInTransaction(first, userA, "offer.exercito", sharedKey),
          purchaseInTransaction(second, userB, "offer.exercito", sharedKey),
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
