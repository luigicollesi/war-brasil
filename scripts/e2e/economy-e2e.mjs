import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { Client } from "pg";

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

const deliveryKeys = [];
const signedR2Keys = [];
const deliveryResponses = [];
const failedAssetRequests = [];

function previewDiagnostics(src, cause) {
  return JSON.stringify({
    src,
    cause,
    deliveryKeys,
    signedR2Keys,
    deliveryResponses,
    failedAssetRequests,
  });
}

async function waitForPreviewImage(scope) {
  const image = scope.getByRole("img").first();
  await image.waitFor({ state: "visible" });
  try {
    await image.evaluate((node) => {
      if (!(node instanceof HTMLImageElement)) {
        throw new Error("preview não foi renderizado como imagem");
      }
      if (node.complete) {
        if (node.naturalWidth > 0) return;
        throw new Error("preview terminou sem conteúdo visual");
      }
      return new Promise((resolve, reject) => {
        node.addEventListener("load", () => resolve(undefined), { once: true });
        node.addEventListener("error", () => reject(new Error("preview image failed")), {
          once: true,
        });
      });
    });
  } catch (error) {
    const src = await image.getAttribute("src").catch(() => null);
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`preview image failed: ${previewDiagnostics(src, cause)}`);
  }
  return image;
}

async function loadStorefront(page) {
  const response = await apiJson(page, "/api/economy/storefront");
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.ok(response.body && typeof response.body === "object");
  return response.body;
}

async function openFeaturedCollection(page) {
  const opener = page.getByRole("button", { name: "ABRIR COLEÇÃO EM DESTAQUE", exact: true });
  await opener.waitFor({ state: "visible" });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  return dialog;
}

function collectionItemCard(dialog, itemName) {
  return dialog.locator("article").filter({ hasText: itemName });
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
  const onboarding = await apiJson(page, "/api/auth/command-access", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, displayName: "Comandante Economia E2E" }),
  });
  assert.equal(onboarding.status, 200, JSON.stringify(onboarding.body));
  assert.equal(onboarding.body?.profileComplete, true);
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
  assert.equal(
    await page.getByRole("button", { name: "Abrir coleção Futebol", exact: true }).count(),
    1,
  );

  const diceCatalog = page.locator('section[aria-labelledby="catalog-title"]');
  for (const item of football.items) {
    assert.equal(
      await diceCatalog.getByText(item.name, { exact: true }).count(),
      0,
      `${item.id} vazou da collection para a grade comum de Dados`,
    );
  }

  let dialog = await openFeaturedCollection(page);
  await dialog.getByRole("heading", { name: "Futebol", exact: true }).waitFor();
  assert.match(normalizeText(await dialog.textContent()), /40% OFF/i);
  assert.match(normalizeText(await dialog.textContent()), /1\.200 CR/i);
  assert.match(normalizeText(await dialog.textContent()), /720 CR/i);

  for (const item of football.items) {
    const card = collectionItemCard(dialog, item.name);
    await card.waitFor({ state: "visible" });
    const cardText = normalizeText(await card.textContent());
    assert.ok(cardText.includes("500 CR"), `${item.id} sem preço-base`);
    assert.ok(cardText.includes("300 CR"), `${item.id} sem preço promocional`);
  }

  const firstItem = football.items[0];
  const firstCard = collectionItemCard(dialog, firstItem.name);
  const firstImage = await waitForPreviewImage(firstCard);
  const firstSrc = await firstImage.getAttribute("src");
  assert.ok(firstSrc, `${firstItem.id} não expôs src de preview`);
  assert.equal(assetKeyFromDeliveryUrl(firstSrc), firstItem.assetRef.split("key=")[1]);

  await firstCard.getByRole("button", { name: "COMPRAR", exact: true }).click();
  await page
    .getByText("Créditos de Campanha insuficientes para esta aquisição.", { exact: true })
    .waitFor();
  assertFreshCommanderState(await readEconomyState(userId));

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

  assert.equal(failedAssetRequests.length, 0, previewDiagnostics(null, "asset request failed"));
  for (const response of deliveryResponses) {
    assert.equal(response.status, 307);
    assert.equal(response.hasLocation, true);
  }
  assert.ok(signedR2Keys.length > 0, "nenhum preview de dado exercitou delivery R2 assinado");
  assert.deepEqual(new Set(signedR2Keys), new Set(deliveryKeys));

  const attackItem = football.items.find((item) => item.slot === "dice_attack");
  assert.ok(attackItem, "collection Futebol sem dado de ataque");
  const attackOffer = singleOfferForItem(storefront, football, attackItem.id);
  const purchaseBalance = attackOffer.price + 100;
  assert.equal(purchaseBalance, 400);
  await setCampaignCreditBalance(userId, purchaseBalance);

  await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-profile-v4-surface="store"]').waitFor({ state: "visible" });
  dialog = await openFeaturedCollection(page);
  const attackCard = collectionItemCard(dialog, attackItem.name);
  await attackCard.waitFor({ state: "visible" });
  await attackCard.getByRole("button", { name: "COMPRAR", exact: true }).click();
  await page
    .getByText("Aquisição confirmada e incorporada ao Arsenal.", { exact: true })
    .waitFor();

  const purchasedState = await readEconomyState(userId);
  assert.equal(purchasedState.balance, "100");
  assert.equal(purchasedState.purchaseCount, 1);
  assert.equal(purchasedState.ledgerCount, 1);
  assert.equal(purchasedState.ledgerDelta, "-300");
  assert.equal(purchasedState.inventoryIds.length, 5);
  assert.ok(purchasedState.inventoryIds.includes(attackItem.id));

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

  await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-profile-v4-surface="store"]').waitFor({ state: "visible" });
  dialog = await openFeaturedCollection(page);
  assert.match(normalizeText(await dialog.textContent()), /800 CR/i);
  assert.match(normalizeText(await dialog.textContent()), /480 CR/i);
  await dialog.getByRole("button", { name: "COMPLETAR COLEÇÃO", exact: true }).waitFor();

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-collection-promotion-v4-1440x900.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-profile-v4-surface="store"]').waitFor({ state: "visible" });
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-v4-390x844.png"),
    fullPage: true,
  });
  dialog = await openFeaturedCollection(page);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-collection-modal-v4-390x844.png"),
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
    `[economy-e2e] ok — Futebol 40% OFF, compra 300 CR, completion 480 CR, equipagem e ${signedR2Keys.length} deliveries R2 validados`,
  );
} finally {
  await context.close();
  await browser.close();
}

process.env.PLAYWRIGHT_RUNTIME_DIR ??= path.resolve("node_modules/playwright");
process.env.LOBBY_E2E_BASE_URL ??= BASE_URL;
process.env.LOBBY_E2E_DATABASE_URL ??= DATABASE_URL;
await import("./economy-purchase-e2e.mjs");
