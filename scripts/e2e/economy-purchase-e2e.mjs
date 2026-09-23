import assert from "node:assert/strict";
import { Client } from "pg";
import { apiJson, loadPlaywrightRuntime } from "./runtime-helper.mjs";
import { completeCommanderOnboarding } from "./command-access-helper.mjs";

const playwright = await loadPlaywrightRuntime();

const BASE_URL = process.env.LOBBY_E2E_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.LOBBY_E2E_DATABASE_URL ?? process.env.DATABASE_URL;

if (!DATABASE_URL) throw new Error("DATABASE_URL E2E é obrigatória.");

const OFFERS = Object.freeze({
  exercito: { id: "offer.exercito", price: 400 },
  lancas: { id: "offer.lancas", price: 400 },
  viking: { id: "offer.viking", price: 1200, partialPrice: 800 },
  futebol: { id: "offer.futebol", price: 720 },
});

let actorSequence = 0;

) {
  return page.evaluate(
    async ({ requestUrl, requestInit }) => {
      const response = await fetch(requestUrl, requestInit);
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { status: response.status, body };
    },
    { requestUrl: url, requestInit: init },
  );
}

async function apiJsonConcurrent(page, requests) {
  return page.evaluate(async (input) => {
    return Promise.all(
      input.map(async ({ url, init }) => {
        const response = await fetch(url, init);
        let body = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        return { status: response.status, body };
      }),
    );
  }, requests);
}

function purchaseRequest(offerId, idempotencyKey, expectedPrice, extra = {}) {
  return {
    url: "/api/economy/purchases",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId, idempotencyKey, expectedPrice, ...extra }),
    },
  };
}

async function verifyE2eEmail(email) {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const result = await db.query(
      `UPDATE auth."user"
          SET "emailVerified"=TRUE,
              "updatedAt"=NOW()
        WHERE email=$1
        RETURNING id::text AS id`,
      [email],
    );
    assert.equal(result.rowCount, 1, `conta E2E não encontrada para ${email}`);
    return result.rows[0].id;
  } finally {
    await db.end();
  }
}

async function createActor(browser, label) {
  actorSequence += 1;
  const identity = `${process.pid}-${Date.now()}-${actorSequence}`;
  const email = `economy-purchase-${identity}@e2e.war-brasil.test`;
  const password = `E2e-${identity}-Aa1!`;
  const handle = `econ_buy_${process.pid}_${actorSequence}`;
  const context = await browser.newContext({
    serviceWorkers: "block",
    extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${110 + actorSequence}` },
  });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/robots.txt`, { waitUntil: "domcontentloaded" });

  const registration = await apiJson(page, "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, termsAccepted: true }),
  });
  assert.equal(registration.status, 200, JSON.stringify(registration.body));

  const userId = await verifyE2eEmail(email);
  const signIn = await apiJson(page, "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe: true }),
  });
  assert.equal(signIn.status, 200, JSON.stringify(signIn.body));

  await completeCommanderOnboarding(page, {
    handle,
    displayName: `Economy Purchase ${label}`,
  });

  return { context, page, userId };
}

async function withDb(callback) {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    return await callback(db);
  } finally {
    await db.end();
  }
}

async function resetEconomyState(userId, balance) {
  await withDb(async (db) => {
    await db.query("BEGIN");
    try {
      await db.query(
        `DELETE FROM economy.purchase_items
          WHERE purchase_id IN (
            SELECT id FROM economy.purchases WHERE user_id=$1::uuid
          )`,
        [userId],
      );
      await db.query(
        `DELETE FROM economy.ledger_entries
          WHERE user_id=$1::uuid
            AND reason='purchase'`,
        [userId],
      );
      await db.query(`DELETE FROM economy.purchases WHERE user_id=$1::uuid`, [userId]);
      await db.query(
        `DELETE FROM inventory.cosmetics owned
          WHERE owned.user_id=$1::uuid
            AND NOT EXISTS (
              SELECT 1
                FROM catalog.cosmetics item
               WHERE item.id=owned.cosmetic_id
                 AND item.is_default=TRUE
            )`,
        [userId],
      );
      await db.query(
        `UPDATE economy.wallets
            SET balance=$2::bigint,
                updated_at=NOW()
          WHERE user_id=$1::uuid
            AND currency_code='campaign-credit'`,
        [userId, balance],
      );
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  });
}

async function grantOneOwnedCosmetic(userId, cosmeticId) {
  await withDb(async (db) => {
    await db.query(
      `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
       SELECT $1::uuid,item.id,item.slot,'admin'
         FROM catalog.cosmetics item
        WHERE item.id=$2
       ON CONFLICT (user_id,cosmetic_id) DO NOTHING`,
      [userId, cosmeticId],
    );
  });
}

async function setOfferStatus(offerId, status) {
  await withDb(async (db) => {
    await db.query(
      `UPDATE catalog.offers
          SET status=$2,
              updated_at=NOW()
        WHERE id=$1`,
      [offerId, status],
    );
  });
}

async function readEconomyState(userId) {
  return withDb(async (db) => {
    const wallet = await db.query(
      `SELECT balance::text AS balance
         FROM economy.wallets
        WHERE user_id=$1::uuid
          AND currency_code='campaign-credit'`,
      [userId],
    );
    const purchases = await db.query(
      `SELECT id::text AS id,
              offer_id,
              price_paid::text AS price_paid,
              offer_item_count,
              idempotency_key
         FROM economy.purchases
        WHERE user_id=$1::uuid
        ORDER BY created_at,id`,
      [userId],
    );
    const ledger = await db.query(
      `SELECT delta::text AS delta,
              reason,
              domain_reference,
              idempotency_key
         FROM economy.ledger_entries
        WHERE user_id=$1::uuid
        ORDER BY created_at,id`,
      [userId],
    );
    const purchaseItems = await db.query(
      `SELECT purchased.purchase_id::text AS purchase_id,
              purchased.cosmetic_id
         FROM economy.purchase_items purchased
         JOIN economy.purchases purchase ON purchase.id=purchased.purchase_id
        WHERE purchase.user_id=$1::uuid
        ORDER BY purchased.purchase_id,purchased.cosmetic_id`,
      [userId],
    );
    const inventory = await db.query(
      `SELECT owned.cosmetic_id,owned.acquisition_source
         FROM inventory.cosmetics owned
        WHERE owned.user_id=$1::uuid
        ORDER BY owned.cosmetic_id`,
      [userId],
    );

    return {
      balance: wallet.rows[0]?.balance ?? null,
      purchases: purchases.rows,
      ledger: ledger.rows,
      purchaseItems: purchaseItems.rows,
      inventory: inventory.rows,
    };
  });
}

function assertSinglePurchaseState(
  state,
  expectedOfferId,
  expectedPrice = 400,
  expectedGrantedCount = 3,
) {
  assert.equal(state.balance, "100");
  assert.equal(state.purchases.length, 1);
  assert.equal(state.purchases[0].offer_id, expectedOfferId);
  assert.equal(state.purchases[0].price_paid, String(expectedPrice));
  assert.equal(state.purchases[0].offer_item_count, 3);
  assert.equal(state.ledger.length, 1);
  assert.equal(state.ledger[0].delta, String(-expectedPrice));
  assert.equal(state.ledger[0].reason, "purchase");
  assert.equal(state.ledger[0].domain_reference, state.purchases[0].id);
  assert.equal(state.ledger[0].idempotency_key, `purchase:${state.purchases[0].id}`);
  assert.equal(state.purchaseItems.length, expectedGrantedCount);
  assert.equal(state.inventory.length, 7);
}

function assertNoPurchaseState(state, expectedBalance) {
  assert.equal(state.balance, String(expectedBalance));
  assert.equal(state.purchases.length, 0);
  assert.equal(state.ledger.length, 0);
  assert.equal(state.purchaseItems.length, 0);
  assert.equal(state.inventory.length, 4);
}

const browser = await playwright.chromium.launch({ headless: true });
const actors = [];

try {
  const primary = await createActor(browser, "Primary");
  actors.push(primary);

  // Same user + same key: both requests resolve to one confirmed receipt.
  await resetEconomyState(primary.userId, 500);
  const sameKey = `purchase-same-${process.pid}-${Date.now()}`;
  const duplicateResponses = await apiJsonConcurrent(primary.page, [
    purchaseRequest(OFFERS.exercito.id, sameKey, OFFERS.exercito.price),
    purchaseRequest(OFFERS.exercito.id, sameKey, OFFERS.exercito.price),
  ]);
  assert.deepEqual(
    duplicateResponses.map((response) => response.status),
    [200, 200],
    JSON.stringify(duplicateResponses),
  );
  assert.equal(
    duplicateResponses[0].body?.purchaseId,
    duplicateResponses[1].body?.purchaseId,
  );
  assert.equal(duplicateResponses[0].body?.acquiredItems?.length, 3);
  assert.equal(duplicateResponses[1].body?.acquiredItems?.length, 3);

  let state = await readEconomyState(primary.userId);
  assertSinglePurchaseState(state, OFFERS.exercito.id);

  const retry = await apiJson(
    primary.page,
    "/api/economy/purchases",
    purchaseRequest(OFFERS.exercito.id, sameKey, OFFERS.exercito.price).init,
  );
  assert.equal(retry.status, 200, JSON.stringify(retry.body));
  assert.equal(retry.body?.purchaseId, duplicateResponses[0].body?.purchaseId);
  assertSinglePurchaseState(await readEconomyState(primary.userId), OFFERS.exercito.id);

  const keyConflict = await apiJson(
    primary.page,
    "/api/economy/purchases",
    purchaseRequest(OFFERS.viking.id, sameKey, OFFERS.viking.price).init,
  );
  assert.equal(keyConflict.status, 409, JSON.stringify(keyConflict.body));
  assert.equal(keyConflict.body?.error, "ECONOMY_IDEMPOTENCY_CONFLICT");

  const alreadyOwned = await apiJson(
    primary.page,
    "/api/economy/purchases",
    purchaseRequest(
      OFFERS.exercito.id,
      `purchase-owned-${process.pid}-${Date.now()}`,
      OFFERS.exercito.price,
    ).init,
  );
  assert.equal(alreadyOwned.status, 409, JSON.stringify(alreadyOwned.body));
  assert.equal(alreadyOwned.body?.error, "ECONOMY_OFFER_ALREADY_OWNED");
  assertSinglePurchaseState(await readEconomyState(primary.userId), OFFERS.exercito.id);

  // Two 400-credit bundles contend on one 500-credit wallet: at most one wins.
  await resetEconomyState(primary.userId, 500);
  const raceResponses = await apiJsonConcurrent(primary.page, [
    purchaseRequest(
      OFFERS.exercito.id,
      `purchase-race-a-${process.pid}-${Date.now()}`,
      OFFERS.exercito.price,
    ),
    purchaseRequest(
      OFFERS.lancas.id,
      `purchase-race-b-${process.pid}-${Date.now()}`,
      OFFERS.lancas.price,
    ),
  ]);
  assert.deepEqual(
    raceResponses.map((response) => response.status).sort((a, b) => a - b),
    [200, 409],
    JSON.stringify(raceResponses),
  );
  const raceSuccess = raceResponses.find((response) => response.status === 200);
  const raceFailure = raceResponses.find((response) => response.status === 409);
  assert.ok(raceSuccess?.body?.offer?.id);
  assert.equal(raceFailure?.body?.error, "ECONOMY_INSUFFICIENT_BALANCE");
  assertSinglePurchaseState(
    await readEconomyState(primary.userId),
    raceSuccess.body.offer.id,
  );

  // Partial ownership charges only missing Viking items, then applies the 20% bundle discount.
  await resetEconomyState(primary.userId, 900);
  await grantOneOwnedCosmetic(primary.userId, "dice.attack.viking");
  const partial = await apiJson(
    primary.page,
    "/api/economy/purchases",
    purchaseRequest(
      OFFERS.viking.id,
      `purchase-partial-${process.pid}-${Date.now()}`,
      OFFERS.viking.partialPrice,
    ).init,
  );
  assert.equal(partial.status, 200, JSON.stringify(partial.body));
  assert.equal(partial.body?.acquiredItems?.length, 2);
  assertSinglePurchaseState(
    await readEconomyState(primary.userId),
    OFFERS.viking.id,
    OFFERS.viking.partialPrice,
    2,
  );

  // Invalid authority fields, insufficient funds, unknown and unavailable offers are inert.
  await resetEconomyState(primary.userId, 0);
  const invalidAuthority = await apiJson(
    primary.page,
    "/api/economy/purchases",
    purchaseRequest(
      OFFERS.futebol.id,
      `purchase-invalid-${process.pid}-${Date.now()}`,
      OFFERS.futebol.price,
      { price: 1 },
    ).init,
  );
  assert.equal(invalidAuthority.status, 400, JSON.stringify(invalidAuthority.body));
  assert.equal(invalidAuthority.body?.error, "ECONOMY_INVALID_PURCHASE");
  assertNoPurchaseState(await readEconomyState(primary.userId), 0);

  const insufficient = await apiJson(
    primary.page,
    "/api/economy/purchases",
    purchaseRequest(
      OFFERS.futebol.id,
      `purchase-empty-${process.pid}-${Date.now()}`,
      OFFERS.futebol.price,
    ).init,
  );
  assert.equal(insufficient.status, 409, JSON.stringify(insufficient.body));
  assert.equal(insufficient.body?.error, "ECONOMY_INSUFFICIENT_BALANCE");
  assertNoPurchaseState(await readEconomyState(primary.userId), 0);

  const missing = await apiJson(
    primary.page,
    "/api/economy/purchases",
    purchaseRequest(
      "offer.does-not-exist",
      `purchase-missing-${process.pid}-${Date.now()}`,
      1,
    ).init,
  );
  assert.equal(missing.status, 404, JSON.stringify(missing.body));
  assert.equal(missing.body?.error, "ECONOMY_OFFER_NOT_FOUND");
  assertNoPurchaseState(await readEconomyState(primary.userId), 0);

  await resetEconomyState(primary.userId, 800);
  await setOfferStatus(OFFERS.futebol.id, "retired");
  try {
    const unavailable = await apiJson(
      primary.page,
      "/api/economy/purchases",
      purchaseRequest(
        OFFERS.futebol.id,
        `purchase-retired-${process.pid}-${Date.now()}`,
        OFFERS.futebol.price,
      ).init,
    );
    assert.equal(unavailable.status, 409, JSON.stringify(unavailable.body));
    assert.equal(unavailable.body?.error, "ECONOMY_OFFER_UNAVAILABLE");
    assertNoPurchaseState(await readEconomyState(primary.userId), 800);
  } finally {
    await setOfferStatus(OFFERS.futebol.id, "available");
  }

  // Idempotency keys are scoped per user; one account cannot inherit another receipt.
  const secondary = await createActor(browser, "Secondary");
  actors.push(secondary);
  await resetEconomyState(primary.userId, 500);
  await resetEconomyState(secondary.userId, 500);
  const sharedKey = `purchase-cross-user-${process.pid}-${Date.now()}`;
  const [primaryCrossUser, secondaryCrossUser] = await Promise.all([
    apiJson(
      primary.page,
      "/api/economy/purchases",
      purchaseRequest(OFFERS.lancas.id, sharedKey, OFFERS.lancas.price).init,
    ),
    apiJson(
      secondary.page,
      "/api/economy/purchases",
      purchaseRequest(OFFERS.lancas.id, sharedKey, OFFERS.lancas.price).init,
    ),
  ]);
  assert.equal(primaryCrossUser.status, 200, JSON.stringify(primaryCrossUser.body));
  assert.equal(secondaryCrossUser.status, 200, JSON.stringify(secondaryCrossUser.body));
  assert.notEqual(primaryCrossUser.body?.purchaseId, secondaryCrossUser.body?.purchaseId);
  assertSinglePurchaseState(await readEconomyState(primary.userId), OFFERS.lancas.id);
  assertSinglePurchaseState(await readEconomyState(secondary.userId), OFFERS.lancas.id);

  console.log(
    "[economy-purchase-e2e] ok — expectedPrice, idempotência, concorrência, completion pricing e isolamento por usuário validados",
  );
} finally {
  for (const actor of actors.reverse()) {
    await actor.context.close().catch(() => undefined);
  }
  await browser.close();
}
