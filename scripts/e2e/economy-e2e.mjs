import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { Client } from "pg";
import { completeCommanderOnboarding } from "./command-access-helper.mjs";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const DATABASE_URL = process.env.DATABASE_URL;
const STORAGE_STATE_PATH = process.env.DOCTRINE_AUTH_STORAGE_STATE;
const ARTIFACT_DIR = path.resolve(
  process.env.ECONOMY_E2E_ARTIFACT_DIR ?? "test-results/economy-eval",
);
const ASSET_ROUTE_PATH = "/api/assets/dice";
const FAKE_WEBP = Buffer.from(
  "UklGRhoAAABXRUJQVlA4TA0AAAAvB8ABEAcQERGIiP4HAA==",
  "base64",
);

if (!DATABASE_URL) throw new Error("DATABASE_URL é obrigatória para Economy E2E.");
if (!STORAGE_STATE_PATH) {
  throw new Error("DOCTRINE_AUTH_STORAGE_STATE é obrigatório para Economy E2E.");
}

mkdirSync(ARTIFACT_DIR, { recursive: true });

async function apiJson(page, url, init = {}) {
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

async function withDb(callback) {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    return await callback(db);
  } finally {
    await db.end();
  }
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
    const ledger = await db.query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(delta),0)::text AS delta
         FROM economy.ledger_entries
        WHERE user_id=$1::uuid`,
      [userId],
    );
    const purchases = await db.query(
      `SELECT COUNT(*)::int AS total
         FROM economy.purchases
        WHERE user_id=$1::uuid`,
      [userId],
    );
    const inventory = await db.query(
      `SELECT item.id
         FROM inventory.cosmetics owned
         JOIN catalog.cosmetics item ON item.id=owned.cosmetic_id
        WHERE owned.user_id=$1::uuid
        ORDER BY item.id`,
      [userId],
    );
    const loadout = await db.query(
      `SELECT slot,cosmetic_id
         FROM profile.cosmetic_loadout
        WHERE user_id=$1::uuid
        ORDER BY slot`,
      [userId],
    );

    return {
      balance: wallet.rows[0]?.balance ?? null,
      ledgerCount: ledger.rows[0]?.total ?? -1,
      ledgerDelta: ledger.rows[0]?.delta ?? null,
      purchaseCount: purchases.rows[0]?.total ?? -1,
      inventoryIds: inventory.rows.map((row) => row.id),
      loadout: loadout.rows,
    };
  });
}

async function setCampaignCreditBalance(userId, balance) {
  assert.ok(Number.isSafeInteger(balance) && balance >= 0);
  await withDb(async (db) => {
    const result = await db.query(
      `UPDATE economy.wallets
          SET balance=$2::bigint,
              updated_at=NOW()
        WHERE user_id=$1::uuid
          AND currency_code='campaign-credit'
        RETURNING balance::text AS balance`,
      [userId, balance],
    );
    assert.equal(result.rowCount, 1);
    assert.equal(result.rows[0].balance, String(balance));
  });
}

function assertFreshCommanderState(state) {
  assert.equal(state.balance, "0");
  assert.equal(state.ledgerCount, 0);
  assert.equal(state.ledgerDelta, "0");
  assert.equal(state.purchaseCount, 0);
  assert.deepEqual(state.inventoryIds, [
    "dice.attack.default",
    "dice.defense.default",
    "dice.neutral.default",
    "territory.effect.default",
  ]);
  assert.deepEqual(state.loadout, [
    { slot: "dice_attack", cosmetic_id: "dice.attack.default" },
    { slot: "dice_defense", cosmetic_id: "dice.defense.default" },
    { slot: "dice_neutral", cosmetic_id: "dice.neutral.default" },
    { slot: "territory_skin", cosmetic_id: "territory.effect.default" },
  ]);
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatBrl(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function collectionShowcaseUrl(collectionId, itemId = null) {
  const base = `${BASE_URL}/profile/store/showcase/collection/${encodeURIComponent(collectionId)}`;
  return itemId ? `${base}?item=${encodeURIComponent(itemId)}` : base;
}

function assetKeyFromDeliveryUrl(value) {
  const url = new URL(value, BASE_URL);
  assert.equal(url.pathname, ASSET_ROUTE_PATH);
  const key = url.searchParams.get("key");
  assert.match(
    key ?? "",
    /^cosmetics\/dice\/[a-z0-9]+(?:-[a-z0-9]+)*\/(attack|defense|neutral)\.webp$/,
  );
  return key;
}

function assetKeyFromSignedR2Url(value) {
  const url = new URL(value);
  assert.ok(
    url.hostname.endsWith(".r2.cloudflarestorage.com"),
    `host R2 inesperado: ${url.hostname}`,
  );
  const marker = "/war-brasil-assets-prod/";
  const markerIndex = url.pathname.indexOf(marker);
  assert.ok(markerIndex >= 0, `path R2 inesperado: ${url.pathname}`);
  const objectKey = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  assert.match(
    objectKey,
    /^cosmetics\/dice\/[a-z0-9]+(?:-[a-z0-9]+)*\/(attack|defense|neutral)\.webp$/,
  );
  assert.equal(url.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  assert.match(url.searchParams.get("X-Amz-Credential") ?? "", /\/.+\/s3\/aws4_request$/);
  assert.match(url.searchParams.get("X-Amz-Signature") ?? "", /^[a-f0-9]{64}$/);
  const expires = Number(url.searchParams.get("X-Amz-Expires"));
  assert.ok(Number.isInteger(expires) && expires > 0 && expires <= 900);
  return objectKey;
}

function offerById(storefront, offerId) {
  const offer = storefront.offers.find((candidate) => candidate.id === offerId);
  assert.ok(offer, `offer ${offerId} ausente do storefront`);
  return offer;
}

function collectionById(storefront, collectionId) {
  const collection = storefront.collections.find((candidate) => candidate.id === collectionId);
  assert.ok(collection, `collection ${collectionId} ausente do storefront`);
  return collection;
}

function singleOfferForItem(storefront, collection, itemId) {
  const offer = collection.singleOfferIds
    .map((offerId) => offerById(storefront, offerId))
    .find((candidate) => candidate.items.length === 1 && candidate.items[0].id === itemId);
  assert.ok(offer, `single offer ausente para ${itemId}`);
  return offer;
}

function bundleOfferForCollection(storefront, collection) {
  assert.equal(collection.bundleOfferIds.length, 1, "collection precisa de um bundle ativo");
  return offerById(storefront, collection.bundleOfferIds[0]);
}

async function loadStorefront(page) {
  const response = await apiJson(page, "/api/economy/storefront");
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.ok(response.body && typeof response.body === "object");
  return response.body;
}

async function waitForShowcase(page, expectedTitle) {
  const root = page.locator('main[aria-label="Expositor da Intendência"]');
  await root.waitFor({ state: "visible" });
  await root.getByText(expectedTitle, { exact: true }).first().waitFor({ state: "visible" });
  return root;
}

const deliveryKeys = [];
const signedR2Keys = [];
const deliveryResponses = [];
const failedAssetRequests = [];

function deliveryDiagnostics(cause) {
  return JSON.stringify({
    cause,
    deliveryKeys,
    signedR2Keys,
    deliveryResponses,
    failedAssetRequests,
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: STORAGE_STATE_PATH,
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
  serviceWorkers: "block",
});
const page = await context.newPage();

await page.route((url) => url.pathname === ASSET_ROUTE_PATH, async (route) => {
  const requestUrl = new URL(route.request().url());
  const expectedKey = assetKeyFromDeliveryUrl(requestUrl.toString());
  const upstream = await route.fetch({ maxRedirects: 0 });
  const headers = upstream.headers();
  const location = headers.location;

  deliveryResponses.push({
    key: expectedKey,
    status: upstream.status(),
    hasLocation: typeof location === "string" && location.length > 0,
  });
  assert.equal(upstream.status(), 307, `delivery deveria redirecionar ${expectedKey}`);
  assert.ok(location, `delivery não retornou Location para ${expectedKey}`);
  const signedKey = assetKeyFromSignedR2Url(location);
  assert.equal(signedKey, expectedKey);
  signedR2Keys.push(signedKey);

  await route.fulfill({
    status: 200,
    contentType: "image/webp",
    body: FAKE_WEBP,
    headers: {
      "Cache-Control": "private, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

page.on("request", (request) => {
  const url = new URL(request.url());
  if (url.pathname === ASSET_ROUTE_PATH) {
    const key = url.searchParams.get("key");
    if (key) deliveryKeys.push(key);
  }
});

page.on("requestfailed", (request) => {
  const url = new URL(request.url());
  if (url.pathname === ASSET_ROUTE_PATH) {
    failedAssetRequests.push({
      target: `${url.pathname}?key=${url.searchParams.get("key") ?? ""}`,
      error: request.failure()?.errorText ?? "unknown",
    });
  }
});

try {
  await page.goto(`${BASE_URL}/robots.txt`, { waitUntil: "domcontentloaded" });
  const session = await apiJson(page, "/api/auth/get-session");
  assert.equal(session.status, 200, JSON.stringify(session.body));
  const userId = session.body?.user?.id;
  assert.match(userId ?? "", /^[0-9a-f-]{36}$/i);

  const handle = `economy_${process.pid}_${String(Date.now()).slice(-6)}`;
  await completeCommanderOnboarding(page, {
    handle,
    displayName: "Comandante Economia E2E",
  });
  assertFreshCommanderState(await readEconomyState(userId));

  await page.goto(`${BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-profile-v4-surface="dossier"]').waitFor({ state: "visible" });
  const profileWallet = page.locator('[data-wallet-available="true"]').first();
  await profileWallet.waitFor({ state: "visible" });
  assert.match(normalizeText(await profileWallet.textContent()), /Créditos de Campanha/i);
  assert.match(normalizeText(await profileWallet.textContent()), /0/);
  assert.equal(await profileWallet.locator('img[src*="coin.svg"]').count(), 1);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "profile-v4-dossier-1440x900.png"),
    fullPage: true,
  });

  await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-profile-v4-surface="store"]').waitFor({ state: "visible" });

  let storefront = await loadStorefront(page);
  const football = collectionById(storefront, "collection.football");
  assert.equal(football.featured, true);
  assert.equal(football.promotionDiscountBps, 4000);
  assert.equal(football.items.length, 3);
  assert.equal(football.singleOfferIds.length, 3);
  assert.equal(football.bundleOfferIds.length, 1);

  let footballBundle = bundleOfferForCollection(storefront, football);
  assert.equal(footballBundle.basePrice, 1200);
  assert.equal(footballBundle.promotionDiscountBps, 4000);
  assert.equal(footballBundle.price, 720);

  for (const item of football.items) {
    const single = singleOfferForItem(storefront, football, item.id);
    assert.equal(single.basePrice, 500);
    assert.equal(single.promotionDiscountBps, 4000);
    assert.equal(single.price, 300);
  }

  const storeWallet = page.locator('[data-wallet-available="true"]').first();
  const storeWalletText = normalizeText(await storeWallet.textContent());
  assert.match(storeWalletText, /Créditos de Campanha/i);
  assert.match(storeWalletText, /0/);
  assert.equal(await storeWallet.locator('img[src*="coin.svg"]').count(), 1);

  await page.getByRole("heading", { name: "Futebol", exact: true }).first().waitFor();
  const collectionLink = page.getByRole("link", {
    name: "Inspecionar coleção Futebol",
    exact: true,
  });
  assert.equal(await collectionLink.count(), 1);
  assert.equal(
    await page.getByRole("button", { name: /ABRIR COLEÇÃO EM DESTAQUE/i }).count(),
    0,
    "o modal editorial antigo não pode voltar ao discovery",
  );
  assert.equal(await page.getByRole("dialog").count(), 0, "SHOWCASE-40 proíbe modal permanente");

  const diceCatalog = page.locator('section[aria-labelledby="catalog-title"]');
  for (const item of football.items) {
    assert.equal(
      await diceCatalog.getByText(item.name, { exact: true }).count(),
      0,
      `${item.id} vazou da collection para a grade comum de Dados`,
    );
  }

  const creditPacks = page.locator('#reforcar-tesouraria article');
  assert.equal(await creditPacks.count(), storefront.creditPacks.length);
  for (const pack of storefront.creditPacks) {
    const card = creditPacks.filter({ hasText: pack.name });
    await card.waitFor({ state: "visible" });
    const cardText = normalizeText(await card.textContent());
    assert.ok(cardText.includes(formatNumber(pack.creditAmount)), `${pack.id} sem quantidade persistida`);
    assert.ok(cardText.includes(normalizeText(formatBrl(pack.priceBrlCents))), `${pack.id} sem preço BRL persistido`);
    assert.equal(await card.locator('img[src*="coin.svg"]').count(), 1);
    const futureButton = card.getByRole("button", { name: "EM BREVE", exact: true });
    assert.equal(await futureButton.count(), 1);
    assert.equal(await futureButton.isDisabled(), true);
  }

  const firstItem = football.items[0];
  await page.goto(collectionShowcaseUrl(football.id, firstItem.id), {
    waitUntil: "domcontentloaded",
  });
  let showcase = await waitForShowcase(page, "Futebol");
  assert.equal(new URL(page.url()).pathname, `/profile/store/showcase/collection/${football.id}`);
  assert.equal(await showcase.getByText("40% OFF", { exact: true }).count() > 0, true);
  assert.equal(await showcase.getByText("720 CR", { exact: true }).count() > 0, true);
  const itemHud = showcase.getByLabel("Item em exposição");
  await itemHud.getByRole("heading", { name: firstItem.name, exact: true }).waitFor();
  assert.match(normalizeText(await showcase.textContent()), /300 CR/);

  const delivered = await page.evaluate(async (assetRef) => {
    const response = await fetch(assetRef);
    return { status: response.status, contentType: response.headers.get("content-type") };
  }, firstItem.assetRef);
  assert.equal(delivered.status, 200);
  assert.match(delivered.contentType ?? "", /^image\/webp(?:;|$)/i);

  await itemHud.getByRole("button", { name: "COMPRAR ITEM", exact: true }).click();
  await page
    .getByText("Créditos insuficientes para concluir esta compra.", { exact: true })
    .waitFor();
  assertFreshCommanderState(await readEconomyState(userId));

  assert.equal(failedAssetRequests.length, 0, deliveryDiagnostics("asset request failed"));
  assert.ok(signedR2Keys.length > 0, "nenhum dado exercitou delivery R2 assinado");
  assert.deepEqual(new Set(signedR2Keys), new Set(deliveryKeys));
  for (const response of deliveryResponses) {
    assert.equal(response.status, 307);
    assert.equal(response.hasLocation, true);
  }

  const attackItem = football.items.find((item) => item.slot === "dice_attack");
  assert.ok(attackItem, "collection Futebol sem dado de ataque");
  const attackOffer = singleOfferForItem(storefront, football, attackItem.id);
  const purchaseBalance = attackOffer.price + 100;
  assert.equal(purchaseBalance, 400);
  await setCampaignCreditBalance(userId, purchaseBalance);

  await page.goto(collectionShowcaseUrl(football.id, attackItem.id), {
    waitUntil: "domcontentloaded",
  });
  showcase = await waitForShowcase(page, "Futebol");
  const attackHud = showcase.getByLabel("Item em exposição");
  await attackHud.getByRole("heading", { name: attackItem.name, exact: true }).waitFor();
  await attackHud.getByRole("button", { name: "COMPRAR ITEM", exact: true }).click();
  await page
    .getByText("Compra confirmada. Arsenal e créditos atualizados pelo Comando.", { exact: true })
    .waitFor();
  await attackHud.getByRole("button", { name: "POSSUÍDO", exact: true }).waitFor();

  const purchasedState = await readEconomyState(userId);
  assert.equal(purchasedState.balance, "100");
  assert.equal(purchasedState.purchaseCount, 1);
  assert.equal(purchasedState.ledgerCount, 1);
  assert.equal(purchasedState.ledgerDelta, "-300");
  assert.equal(purchasedState.inventoryIds.length, 5);
  assert.ok(purchasedState.inventoryIds.includes(attackItem.id));
  assert.equal(
    purchasedState.loadout.some(
      (entry) => entry.slot === attackItem.slot && entry.cosmetic_id === attackItem.id,
    ),
    false,
    "comprar no Expositor não pode auto-equipar",
  );

  await page.goto(`${BASE_URL}/profile/arsenal`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Equipamento do Comandante", exact: true }).waitFor();
  assert.equal(await page.locator('article[data-slot]').count(), 4);

  const ownedCard = page.locator("button").filter({ hasText: attackItem.name }).first();
  await ownedCard.waitFor({ state: "visible" });
  await ownedCard.click();
  const inspector = page.locator('aside[aria-live="polite"]');
  await inspector.getByRole("heading", { name: attackItem.name, exact: true }).waitFor();
  const equipButton = inspector.getByRole("button", { name: "EQUIPAR", exact: true });
  assert.equal(await equipButton.count(), 1);
  await equipButton.click();
  await page.getByText(new RegExp(`${attackItem.name} equipado em`)).waitFor();

  const equippedState = await readEconomyState(userId);
  assert.equal(equippedState.balance, purchasedState.balance);
  assert.equal(equippedState.purchaseCount, purchasedState.purchaseCount);
  assert.equal(equippedState.ledgerCount, purchasedState.ledgerCount);
  assert.equal(equippedState.ledgerDelta, purchasedState.ledgerDelta);
  assert.equal(
    equippedState.loadout.some(
      (entry) => entry.slot === attackItem.slot && entry.cosmetic_id === attackItem.id,
    ),
    true,
  );

  storefront = await loadStorefront(page);
  const updatedFootball = collectionById(storefront, "collection.football");
  footballBundle = bundleOfferForCollection(storefront, updatedFootball);
  assert.equal(updatedFootball.partiallyOwned, true);
  assert.equal(updatedFootball.ownedCount, 1);
  assert.equal(footballBundle.basePrice, 800);
  assert.equal(footballBundle.price, 480);

  await page.goto(collectionShowcaseUrl(updatedFootball.id, attackItem.id), {
    waitUntil: "domcontentloaded",
  });
  showcase = await waitForShowcase(page, "Futebol");
  assert.equal(await showcase.getByText("480 CR", { exact: true }).count() > 0, true);
  await showcase.getByRole("button", { name: "COMPLETAR", exact: true }).waitFor();
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-showcase-promotion-v1-1440x900.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-profile-v4-surface="store"]').waitFor({ state: "visible" });
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-v4-390x844.png"),
    fullPage: true,
  });

  await page.goto(collectionShowcaseUrl(updatedFootball.id, attackItem.id), {
    waitUntil: "domcontentloaded",
  });
  await waitForShowcase(page, "Futebol");
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-showcase-v1-390x844.png"),
    fullPage: true,
  });

  await page.goto(`${BASE_URL}/profile/arsenal`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Equipamento do Comandante", exact: true }).waitFor();
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "arsenal-v4-390x844.png"),
    fullPage: true,
  });

  const anonymousContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
    assert.equal(new URL(anonymousPage.url()).pathname, "/");
  } finally {
    await anonymousContext.close();
  }

  console.log(
    `[economy-e2e] ok — Futebol 40% OFF, Expositor dedicado, compra 300 CR, completion 480 CR, equipagem e ${signedR2Keys.length} deliveries R2 validados`,
  );
} finally {
  await context.close();
  await browser.close();
}

process.env.PLAYWRIGHT_RUNTIME_DIR ??= path.resolve("node_modules/playwright");
process.env.LOBBY_E2E_BASE_URL ??= BASE_URL;
process.env.LOBBY_E2E_DATABASE_URL ??= DATABASE_URL;
await import("./economy-purchase-e2e.mjs");
