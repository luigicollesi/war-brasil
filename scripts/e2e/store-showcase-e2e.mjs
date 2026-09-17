import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

const playwrightRuntimeDir = path.resolve(
  process.env.PLAYWRIGHT_RUNTIME_DIR ?? ".e2e-runtime/node_modules/playwright",
);
const playwright = await import(
  pathToFileURL(path.join(playwrightRuntimeDir, "index.mjs")).href,
);

const BASE_URL = process.env.LOBBY_E2E_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.LOBBY_E2E_DATABASE_URL ?? process.env.DATABASE_URL;
const ARTIFACT_DIR = path.resolve(
  process.env.STORE_SHOWCASE_E2E_ARTIFACT_DIR ?? "test-results/store-showcase-eval",
);
const ASSET_ROUTE_PATH = "/api/assets/dice";
const FAKE_WEBP = Buffer.from(
  "UklGRhoAAABXRUJQVlA4TA0AAAAvB8ABEAcQERGIiP4HAA==",
  "base64",
);
const VIEWPORTS = [
  [360, 640],
  [390, 844],
  [768, 1024],
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
];

if (!DATABASE_URL) throw new Error("DATABASE_URL E2E é obrigatória para Store Showcase E2E.");
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

async function verifyE2eEmail(email) {
  return withDb(async (db) => {
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

async function setCollectionPromotionDiscount(collectionId, discountBps) {
  assert.ok(Number.isSafeInteger(discountBps) && discountBps >= 0 && discountBps <= 10_000);
  await withDb(async (db) => {
    const result = await db.query(
      `UPDATE catalog.collections
          SET promotion_discount_bps=$2,
              updated_at=NOW()
        WHERE id=$1
          AND featured=TRUE
        RETURNING promotion_discount_bps`,
      [collectionId, discountBps],
    );
    assert.equal(result.rowCount, 1, `coleção featured ${collectionId} ausente`);
    assert.equal(result.rows[0].promotion_discount_bps, discountBps);
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
    const inventory = await db.query(
      `SELECT cosmetic_id
         FROM inventory.cosmetics
        WHERE user_id=$1::uuid
        ORDER BY cosmetic_id`,
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
      inventoryIds: inventory.rows.map((row) => row.cosmetic_id),
      loadout: loadout.rows,
    };
  });
}

async function createActor(browser, forwardedFor = "198.51.100.147") {
  const identity = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `store-showcase-${identity}@e2e.war-brasil.test`;
  const password = `E2e-${identity}-Aa1!`;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
    extraHTTPHeaders: { "x-forwarded-for": forwardedFor },
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

  const onboarding = await apiJson(page, "/api/auth/command-access", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: `showcase_${process.pid}_${String(Date.now()).slice(-6)}_${Math.random().toString(36).slice(2, 5)}`,
      displayName: "Store Showcase E2E",
    }),
  });
  assert.equal(onboarding.status, 200, JSON.stringify(onboarding.body));
  assert.equal(onboarding.body?.profileComplete, true);

  return { context, page, userId };
}

async function installDiceAssetMock(context) {
  await context.route((url) => url.pathname === ASSET_ROUTE_PATH, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/webp",
      body: FAKE_WEBP,
      headers: { "Cache-Control": "private, max-age=60" },
    });
  });
}

function offerById(storefront, offerId) {
  const offer = storefront.offers.find((candidate) => candidate.id === offerId);
  assert.ok(offer, `offer ${offerId} ausente`);
  return offer;
}

function collectionById(storefront, collectionId) {
  const collection = storefront.collections.find((candidate) => candidate.id === collectionId);
  assert.ok(collection, `collection ${collectionId} ausente`);
  return collection;
}

function bundleOfferForCollection(storefront, collection) {
  assert.ok(collection.bundleOfferIds.length > 0, "collection sem bundle ativo");
  return offerById(storefront, collection.bundleOfferIds[0]);
}

function singleOfferForItem(storefront, itemId) {
  const offer = storefront.offers.find(
    (candidate) => candidate.items.length === 1 && candidate.items[0]?.id === itemId,
  );
  assert.ok(offer, `offer individual para ${itemId} ausente`);
  return offer;
}

function currentItemButton(page) {
  return page.locator('[aria-label="Itens da exposição"] button[aria-current="true"]');
}

async function waitForShowcase(page) {
  const root = page.getByRole("main", { name: "Expositor da Intendência" });
  await root.waitFor({ state: "visible" });
  return root;
}

async function assertViewport(page, showcaseUrl, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(showcaseUrl, { waitUntil: "domcontentloaded" });
  const root = await waitForShowcase(page);
  const rootBox = await root.boundingBox();
  const stageBox = await page.locator('[data-showcase-zone="stage"]').boundingBox();
  const objectBox = await page.locator('[data-showcase-object-type]').boundingBox();
  const dockBox = await page.locator('[data-showcase-zone="dock"]').boundingBox();
  const primaryCta = page.locator('[data-showcase-zone="dock"] button').last();
  const ctaBox = await primaryCta.boundingBox();
  const documentMetrics = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    innerHeight: window.innerHeight,
  }));

  assert.ok(rootBox, `${width}x${height}: root sem bounds`);
  assert.ok(stageBox, `${width}x${height}: stage sem bounds`);
  assert.ok(objectBox, `${width}x${height}: objeto sem bounds`);
  assert.ok(dockBox, `${width}x${height}: dock sem bounds`);
  assert.ok(ctaBox, `${width}x${height}: CTA sem bounds`);
  assert.ok(
    documentMetrics.scrollHeight <= documentMetrics.clientHeight + 2,
    `${width}x${height}: scroll vertical ${documentMetrics.scrollHeight}/${documentMetrics.clientHeight}`,
  );
  assert.ok(Math.abs(rootBox.height - documentMetrics.innerHeight) <= 2);
  assert.ok(stageBox.height >= height * 0.52, `${width}x${height}: stage pouco dominante`);
  assert.ok(objectBox.height >= Math.min(240, height * 0.38), `${width}x${height}: objeto pequeno`);
  assert.ok(ctaBox.y >= -1 && ctaBox.y + ctaBox.height <= height + 2, `${width}x${height}: CTA cortado`);
  assert.ok(dockBox.y + dockBox.height <= height + 2, `${width}x${height}: dock fora da viewport`);
}

async function loadStorefront(page) {
  const response = await apiJson(page, "/api/economy/storefront");
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.ok(response.body && typeof response.body === "object");
  return response.body;
}

const browser = await playwright.chromium.launch({ headless: true });
const actor = await createActor(browser);
await installDiceAssetMock(actor.context);

try {
  const { context, page, userId } = actor;
  await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
  let storefront = await loadStorefront(page);
  const football = collectionById(storefront, "collection.football");
  assert.ok(football.assets?.background, "Futebol precisa de background canônico para SHOWCASE-06");
  assert.equal(football.promotionDiscountBps, 4000);
  const showcaseUrl = `${BASE_URL}/profile/store/showcase/collection/${encodeURIComponent(football.id)}`;
  const backgroundUrl = new URL(football.assets.background, BASE_URL).toString();
  let backgroundRequests = 0;
  const backgroundPredicate = (url) => url.toString() === backgroundUrl;
  const backgroundSuccess = async (route) => {
    backgroundRequests += 1;
    await route.fulfill({ status: 200, contentType: "image/webp", body: FAKE_WEBP });
  };
  await context.route(backgroundPredicate, backgroundSuccess);

  const initialBalance = 2_000;
  await setCampaignCreditBalance(userId, initialBalance);

  const staleActor = await createActor(browser, "198.51.100.150");
  await installDiceAssetMock(staleActor.context);
  await staleActor.context.route(backgroundPredicate, async (route) => {
    await route.fulfill({ status: 200, contentType: "image/webp", body: FAKE_WEBP });
  });
  try {
    const stalePage = staleActor.page;
    await stalePage.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
    const staleStorefront = await loadStorefront(stalePage);
    const staleFootball = collectionById(staleStorefront, football.id);
    const staleItem = staleFootball.items[0];
    assert.ok(staleItem, "Football precisa de item individual para SHOWCASE-28");
    const staleInitialOffer = singleOfferForItem(staleStorefront, staleItem.id);
    assert.equal(staleInitialOffer.price, 300);
    await setCampaignCreditBalance(staleActor.userId, 1_000);

    const staleShowcaseUrl = `${BASE_URL}/profile/store/showcase/collection/${encodeURIComponent(staleFootball.id)}?item=${encodeURIComponent(staleItem.id)}`;
    await stalePage.goto(staleShowcaseUrl, { waitUntil: "domcontentloaded" });
    await waitForShowcase(stalePage);
    const staleItemHud = stalePage.locator('[aria-label="Item em exposição"]');
    await staleItemHud.getByText("300 CR", { exact: true }).waitFor({ state: "visible" });
    const staleSelectedBeforeAttempt = await currentItemButton(stalePage).textContent();
    const stalePriceStateBeforeAttempt = await readEconomyState(staleActor.userId);

    await setCollectionPromotionDiscount(football.id, 2000);
    const staleInitialCta = stalePage.getByRole("button", { name: "COMPRAR ITEM", exact: true });
    await staleInitialCta.focus();
    await stalePage.keyboard.press("Enter");
    await stalePage
      .getByRole("status")
      .filter({ hasText: "O preço mudou para 400 CR. Confirme o novo valor." })
      .waitFor({ state: "visible" });

    const stalePriceStateAfterAttempt = await readEconomyState(staleActor.userId);
    assert.equal(stalePriceStateAfterAttempt.balance, stalePriceStateBeforeAttempt.balance);
    assert.deepEqual(stalePriceStateAfterAttempt.inventoryIds, stalePriceStateBeforeAttempt.inventoryIds);
    assert.equal(await currentItemButton(stalePage).textContent(), staleSelectedBeforeAttempt);
    await staleItemHud.getByText("400 CR", { exact: true }).waitFor({ state: "visible" });

    const stalePriceCta = stalePage.getByRole("button", { name: "COMPRAR ITEM", exact: true });
    await stalePriceCta.focus();
    await stalePage.keyboard.press("Enter");
    await stalePage
      .getByRole("status")
      .filter({ hasText: "Compra confirmada" })
      .waitFor({ state: "visible" });
    await stalePage.waitForFunction(() =>
      document.querySelector('[aria-label="Itens da exposição"] button[aria-current="true"]')?.textContent?.includes("POSSUÍDO"),
    );

    const stalePriceStateAfterPurchase = await readEconomyState(staleActor.userId);
    assert.equal(stalePriceStateAfterPurchase.balance, String(Number(stalePriceStateBeforeAttempt.balance) - 400));
    assert.ok(stalePriceStateAfterPurchase.inventoryIds.includes(staleItem.id));
  } finally {
    await setCollectionPromotionDiscount(football.id, 4000);
    await staleActor.context.close();
  }

  const heroLink = page.getByRole("link", { name: "INSPECIONAR COLEÇÃO", exact: true }).first();
  await heroLink.waitFor({ state: "visible" });
  await heroLink.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.pathname.includes("/profile/store/showcase/collection/"));
  await waitForShowcase(page);
  await page.getByRole("link", { name: /INTENDÊNCIA/ }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.pathname === "/profile/store");

  for (const [width, height] of VIEWPORTS) {
    await assertViewport(page, showcaseUrl, width, height);
  }
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "showcase-collection-360x640.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(showcaseUrl, { waitUntil: "domcontentloaded" });
  const root = await waitForShowcase(page);
  assert.equal(await page.locator("canvas.command-foundation-canvas").count(), 1);
  assert.equal(await root.getAttribute("data-collection-background"), "ready");
  assert.ok(backgroundRequests > 0, "background canônico não foi requisitado");

  const firstSelected = await currentItemButton(page).textContent();
  const nextArrow = page.getByRole("button", { name: "Exibir próximo item", exact: true });
  await nextArrow.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (previous) => document.querySelector('[aria-label="Itens da exposição"] button[aria-current="true"]')?.textContent !== previous,
    firstSelected,
  );
  assert.notEqual(await currentItemButton(page).textContent(), firstSelected);
  assert.equal(await currentItemButton(page).evaluate((node) => node === document.activeElement), false);

  const storageState = await context.storageState();
  const noWebGlContext = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
    extraHTTPHeaders: { "x-forwarded-for": "198.51.100.148" },
  });
  await installDiceAssetMock(noWebGlContext);
  await noWebGlContext.route(backgroundPredicate, async (route) => {
    await route.fulfill({ status: 200, contentType: "image/webp", body: FAKE_WEBP });
  });
  await noWebGlContext.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(kind, ...args) {
      if (String(kind).toLowerCase().includes("webgl")) return null;
      return originalGetContext.call(this, kind, ...args);
    };
  });

  try {
    const fallbackPage = await noWebGlContext.newPage();
    await fallbackPage.goto(showcaseUrl, { waitUntil: "domcontentloaded" });
    await waitForShowcase(fallbackPage);
    const fallback = fallbackPage.locator("[data-showcase-fallback]");
    await fallback.waitFor({ state: "visible" });
    assert.equal(await fallback.getByRole("img").count(), 1, "dado sem fallback 2D canônico");
    assert.equal(await fallbackPage.locator("canvas.command-foundation-canvas").count(), 0);

    const fallbackSelectedBeforeNavigation = await currentItemButton(fallbackPage).textContent();
    assert.ok(fallbackSelectedBeforeNavigation);
    const fallbackNextArrow = fallbackPage.getByRole("button", {
      name: "Exibir próximo item",
      exact: true,
    });
    await fallbackNextArrow.focus();
    await fallbackPage.keyboard.press("Enter");
    await fallbackPage.waitForFunction(
      (previous) =>
        document.querySelector('[aria-label="Itens da exposição"] button[aria-current="true"]')?.textContent !== previous,
      fallbackSelectedBeforeNavigation,
    );
    const fallbackSelectedAfterNavigation = await currentItemButton(fallbackPage).textContent();
    assert.ok(fallbackSelectedAfterNavigation);
    assert.notEqual(fallbackSelectedAfterNavigation, fallbackSelectedBeforeNavigation);
    await fallback.waitFor({ state: "visible" });
    assert.equal(await fallback.getByRole("img").count(), 1, "navegação degradada perdeu o fallback 2D");

    const buyItem = fallbackPage.getByRole("button", { name: "COMPRAR ITEM", exact: true });
    await buyItem.focus();
    await fallbackPage.keyboard.press("Enter");
    await fallbackPage
      .getByRole("status")
      .filter({ hasText: "Compra confirmada" })
      .waitFor({ state: "visible" });
    await fallbackPage.waitForFunction(() =>
      document.querySelector('[aria-label="Itens da exposição"] button[aria-current="true"]')?.textContent?.includes("POSSUÍDO"),
    );

    storefront = await loadStorefront(fallbackPage);
    const afterSingle = collectionById(storefront, football.id);
    assert.equal(afterSingle.ownedCount, 1);
    assert.equal(afterSingle.partiallyOwned, true);

    const territoryOffer = storefront.offers.find(
      (offer) => offer.items.length === 1 && offer.items[0]?.slot === "territory_skin",
    );
    assert.ok(territoryOffer, "catálogo E2E sem offer de território");
    const territoryUrl = `${BASE_URL}/profile/store/showcase/offer/${encodeURIComponent(territoryOffer.id)}?item=${encodeURIComponent(territoryOffer.items[0].id)}`;
    await fallbackPage.goto(territoryUrl, { waitUntil: "domcontentloaded" });
    await waitForShowcase(fallbackPage);
    await fallbackPage.locator("[data-showcase-fallback]").waitFor({ state: "visible" });
    await fallbackPage
      .locator('svg[aria-label="Prévia 2D do território canônico"]')
      .waitFor({ state: "visible" });
  } finally {
    await noWebGlContext.close();
  }

  storefront = await loadStorefront(page);
  const afterSingle = collectionById(storefront, football.id);
  const completionOffer = bundleOfferForCollection(storefront, afterSingle);
  assert.equal(afterSingle.ownedCount, 1);
  assert.equal(completionOffer.price, 480);

  await page.goto(showcaseUrl, { waitUntil: "domcontentloaded" });
  await waitForShowcase(page);
  const bundleCta = page.getByRole("button", { name: "COMPLETAR", exact: true });
  await bundleCta.waitFor({ state: "visible" });
  await bundleCta.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("status")
    .filter({ hasText: "Compra confirmada" })
    .waitFor({ state: "visible" });
  await page.getByRole("button", { name: "COMPLETO", exact: true }).waitFor({ state: "visible" });

  storefront = await loadStorefront(page);
  const completedFootball = collectionById(storefront, football.id);
  assert.equal(completedFootball.fullyOwned, true);
  assert.equal(completedFootball.ownedCount, completedFootball.totalCount);
  const finalState = await readEconomyState(userId);
  assert.equal(finalState.balance, String(initialBalance - 300 - 480));
  for (const item of football.items) {
    assert.ok(finalState.inventoryIds.includes(item.id), `${item.id} não foi adquirido`);
  }
  assert.deepEqual(
    finalState.loadout.map((entry) => entry.cosmetic_id).sort(),
    [
      "dice.attack.default",
      "dice.defense.default",
      "dice.neutral.default",
      "territory.effect.default",
    ].sort(),
    "compra no showcase não pode auto-equipar",
  );

  const backgroundFailureContext = await browser.newContext({
    storageState: await context.storageState(),
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
    extraHTTPHeaders: { "x-forwarded-for": "198.51.100.149" },
  });
  await installDiceAssetMock(backgroundFailureContext);
  await backgroundFailureContext.route(backgroundPredicate, async (route) => route.abort("failed"));
  try {
    const failurePage = await backgroundFailureContext.newPage();
    await failurePage.goto(showcaseUrl, { waitUntil: "domcontentloaded" });
    const failureRoot = await waitForShowcase(failurePage);
    await failurePage.waitForFunction(() =>
      document.querySelector('main[aria-label="Expositor da Intendência"]')?.getAttribute("data-collection-background") === "fallback",
    );
    assert.equal(await failureRoot.getAttribute("data-collection-background"), "fallback");
    assert.equal(await failurePage.locator('[data-showcase-zone="dock"] button').last().isVisible(), true);
  } finally {
    await backgroundFailureContext.close();
  }

  const invalidResponse = await page.goto(
    `${BASE_URL}/profile/store/showcase/collection/collection.nao-existe`,
    { waitUntil: "domcontentloaded" },
  );
  assert.equal(invalidResponse?.status(), 404);

  console.log(
    `[store-showcase-e2e] ok — ${VIEWPORTS.length} viewports, stale price fail-closed, WebGL/2D fallback, compra individual, completion e background fallback validados`,
  );
} finally {
  await actor.context.close();
  await browser.close();
}
