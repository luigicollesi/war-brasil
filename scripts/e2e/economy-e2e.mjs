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

async function readCommerceCatalog() {
  return withDb(async (db) => {
    const offers = await db.query(
      `SELECT offer.id,
              offer.name,
              offer.price::text AS price,
              (SELECT COUNT(*)::int
                 FROM catalog.offer_items membership
                WHERE membership.offer_id=offer.id) AS item_count
         FROM catalog.offers offer
        WHERE offer.status='available'
        ORDER BY offer.sort_order,offer.id`,
    );
    const creditPacks = await db.query(
      `SELECT id,name,credit_amount::text AS credit_amount,price_brl_cents::text AS price_brl_cents
         FROM catalog.credit_packs
        WHERE status='announced'
        ORDER BY sort_order,id`,
    );

    return {
      offers: offers.rows.map((row) => ({
        id: row.id,
        name: row.name,
        price: Number(row.price),
        itemCount: row.item_count,
      })),
      creditPacks: creditPacks.rows.map((row) => ({
        id: row.id,
        name: row.name,
        creditAmount: Number(row.credit_amount),
        priceBrlCents: Number(row.price_brl_cents),
      })),
    };
  });
}

async function readOfferItems(offerId) {
  return withDb(async (db) => {
    const result = await db.query(
      `SELECT item.id,item.name,item.slot
         FROM catalog.offer_items membership
         JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
        WHERE membership.offer_id=$1
        ORDER BY membership.position,item.id`,
      [offerId],
    );
    return result.rows;
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

async function setOfferPrice(offerId, price) {
  assert.ok(Number.isSafeInteger(price) && price > 0);
  await withDb(async (db) => {
    const result = await db.query(
      `UPDATE catalog.offers
          SET price=$2::bigint,
              updated_at=NOW()
        WHERE id=$1
        RETURNING price::text AS price`,
      [offerId, price],
    );
    assert.equal(result.rowCount, 1);
    assert.equal(result.rows[0].price, String(price));
  });
}

async function insertDynamicOffer({ id, slug, name, price, sourceOfferId }) {
  await withDb(async (db) => {
    await db.query("BEGIN");
    try {
      await db.query(
        `INSERT INTO catalog.offers(
           id,slug,name,description,currency_code,price,status,is_featured,sort_order
         )
         VALUES($1,$2,$3,'Offer criada pelo E2E sem alteração React.','campaign-credit',$4::bigint,'available',FALSE,999)`,
        [id, slug, name, price],
      );
      const copied = await db.query(
        `INSERT INTO catalog.offer_items(offer_id,cosmetic_id,position)
         SELECT $1,membership.cosmetic_id,membership.position
           FROM catalog.offer_items membership
          WHERE membership.offer_id=$2
         RETURNING cosmetic_id`,
        [id, sourceOfferId],
      );
      assert.ok(copied.rowCount > 0, "offer dinâmica precisa de composição válida");
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  });
}

async function deleteDynamicOffer(offerId) {
  await withDb((db) => db.query(`DELETE FROM catalog.offers WHERE id=$1`, [offerId]));
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
    { slot: "territory_effect", cosmetic_id: "territory.effect.default" },
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
  const image = scope.getByRole("img");
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

function catalogSection(page) {
  return page.locator('section[aria-labelledby="catalog-title"]');
}

function offerCard(page, offerName) {
  return catalogSection(page).locator("article").filter({ hasText: offerName });
}

async function openOfferInspection(page, offerName) {
  const card = offerCard(page, offerName);
  await card.locator("button").first().click();
  const inspection = page.locator('section[aria-labelledby="inspection-title-desktop"]');
  await inspection.getByRole("heading", { name: offerName, exact: true }).waitFor();
  return { card, inspection };
}

async function inspectDiceOffer(page, offerName, expectedKey, screenshotName) {
  const { card, inspection } = await openOfferInspection(page, offerName);
  const image = await waitForPreviewImage(inspection);
  const src = await image.getAttribute("src");
  assert.ok(src, `${offerName} não expôs src de preview`);
  assert.equal(assetKeyFromDeliveryUrl(src), expectedKey);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, screenshotName),
    fullPage: true,
  });

  return { card, inspection };
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
  assert.equal(await page.locator('main[data-profile-v4][data-active-surface="dossier"]').count(), 1);

  const profileWallet = page.locator('[data-wallet-available="true"]').first();
  await profileWallet.waitFor({ state: "visible" });
  assert.match(normalizeText(await profileWallet.textContent()), /Créditos de Campanha/i);
  assert.match(normalizeText(await profileWallet.textContent()), /0/);
  assert.equal(await profileWallet.locator('img[src*="coin.svg"]').count(), 1);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "profile-v4-dossier-1440x900.png"),
    fullPage: true,
  });

  await page.locator('a[href="/profile/store"]').first().click();
  await page.waitForURL(`${BASE_URL}/profile/store`);
  await page.getByRole("heading", { name: "Remessas do Comando", exact: true }).waitFor();
  assert.equal(await page.locator('[data-profile-v4-surface="store"]').count(), 1);
  assert.equal(await page.locator('main[data-profile-v4][data-active-surface="store"]').count(), 1);

  const commerce = await readCommerceCatalog();
  assert.ok(commerce.offers.length > 0, "catálogo comercial sem offers disponíveis");

  const storeWallet = page.locator('[data-wallet-available="true"]').first();
  const storeWalletText = normalizeText(await storeWallet.textContent());
  assert.match(storeWalletText, /Créditos de Campanha/i);
  assert.match(storeWalletText, /0/);
  assert.equal(await storeWallet.locator('img[src*="coin.svg"]').count(), 1);

  let catalog = catalogSection(page);
  assert.equal(await catalog.locator("article").count(), commerce.offers.length);
  for (const offer of commerce.offers) {
    const card = offerCard(page, offer.name);
    await card.waitFor({ state: "visible" });
    assert.ok(normalizeText(await card.textContent()).includes(formatNumber(offer.price)));
    assert.equal(await card.locator('img[src*="coin.svg"]').count(), 1);
    const buyButton = card.getByRole("button", { name: "COMPRAR", exact: true });
    assert.equal(await buyButton.count(), 1);
    assert.equal(await buyButton.isEnabled(), true, `${offer.id} deveria delegar saldo ao servidor`);
  }

  const zeroBalanceOffer = commerce.offers[0];
  await offerCard(page, zeroBalanceOffer.name)
    .getByRole("button", { name: "COMPRAR", exact: true })
    .click();
  await page
    .getByText("Créditos de Campanha insuficientes para esta aquisição.", { exact: true })
    .waitFor();
  assertFreshCommanderState(await readEconomyState(userId));

  const creditPacks = page.locator('#reforcar-tesouraria article');
  assert.equal(await creditPacks.count(), commerce.creditPacks.length);
  for (const pack of commerce.creditPacks) {
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

  const dynamicOffer = {
    id: "offer.e2e.dynamic",
    slug: "e2e-dynamic",
    name: "Oferta Dinâmica E2E",
    price: 777,
    sourceOfferId: commerce.offers[0].id,
  };
  try {
    await insertDynamicOffer(dynamicOffer);
    await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Remessas do Comando", exact: true }).waitFor();
    catalog = catalogSection(page);
    assert.equal(await catalog.locator("article").count(), commerce.offers.length + 1);
    const dynamicCard = offerCard(page, dynamicOffer.name);
    await dynamicCard.waitFor({ state: "visible" });
    assert.ok(normalizeText(await dynamicCard.textContent()).includes(formatNumber(dynamicOffer.price)));
    assert.equal(await dynamicCard.getByRole("button", { name: "COMPRAR", exact: true }).count(), 1);
    assertFreshCommanderState(await readEconomyState(userId));
  } finally {
    await deleteDynamicOffer(dynamicOffer.id);
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-v4-1440x900.png"),
    fullPage: true,
  });

  const diceInspectionTargets = [
    ["Exército Clássico", "cosmetics/dice/military-classic/attack.webp", "detail-exercito.png"],
    ["Lanças Medievais", "cosmetics/dice/medieval-spears/attack.webp", "detail-lancas.png"],
    ["Viking", "cosmetics/dice/viking/attack.webp", "detail-viking.png"],
    ["Gato", "cosmetics/dice/cat/attack.webp", "detail-gato.png"],
    ["Cachorro", "cosmetics/dice/dog/attack.webp", "detail-cachorro.png"],
    ["Futebol", "cosmetics/dice/football/attack.webp", "detail-futebol.png"],
  ];
  const availableOfferNames = new Set(commerce.offers.map((offer) => offer.name));
  for (const [offerName, key, screenshot] of diceInspectionTargets) {
    if (!availableOfferNames.has(offerName)) continue;
    await inspectDiceOffer(page, offerName, key, screenshot);
  }

  if (availableOfferNames.has("Exército Clássico")) {
    const { inspection } = await openOfferInspection(page, "Exército Clássico");
    const selector = inspection.getByRole("group", { name: "Itens de Exército Clássico" });
    const defense = selector.locator("button").filter({ hasText: "Defesa" });
    await defense.click();
    const defenseImage = await waitForPreviewImage(inspection);
    const defenseSrc = await defenseImage.getAttribute("src");
    assert.ok(defenseSrc);
    assert.equal(
      assetKeyFromDeliveryUrl(defenseSrc),
      "cosmetics/dice/military-classic/defense.webp",
    );
  }

  assert.equal(failedAssetRequests.length, 0, previewDiagnostics(null, "asset request failed"));
  for (const response of deliveryResponses) {
    assert.equal(response.status, 307);
    assert.equal(response.hasLocation, true);
  }
  assert.ok(signedR2Keys.length > 0, "nenhum preview de dado exercitou delivery R2 assinado");
  assert.deepEqual(new Set(signedR2Keys), new Set(deliveryKeys));
  assertFreshCommanderState(await readEconomyState(userId));

  const livePriceOffer = commerce.offers[0];
  const probePrice = livePriceOffer.price + 37;
  try {
    await setOfferPrice(livePriceOffer.id, probePrice);
    await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Remessas do Comando", exact: true }).waitFor();
    const repricedCard = offerCard(page, livePriceOffer.name);
    assert.ok(
      normalizeText(await repricedCard.textContent()).includes(formatNumber(probePrice)),
      `${livePriceOffer.id} não refletiu alteração persistida de preço`,
    );
    assertFreshCommanderState(await readEconomyState(userId));
  } finally {
    await setOfferPrice(livePriceOffer.id, livePriceOffer.price);
  }

  const purchaseBalance = livePriceOffer.price + 100;
  await setCampaignCreditBalance(userId, purchaseBalance);
  await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Remessas do Comando", exact: true }).waitFor();
  const fundedWallet = page.locator('[data-wallet-available="true"]').first();
  assert.ok(normalizeText(await fundedWallet.textContent()).includes(formatNumber(purchaseBalance)));

  let purchaseCard = offerCard(page, livePriceOffer.name);
  const buyButton = purchaseCard.getByRole("button", { name: "COMPRAR", exact: true });
  assert.equal(await buyButton.isEnabled(), true);
  await buyButton.click();
  await page
    .getByText("Aquisição confirmada e incorporada ao Arsenal.", { exact: true })
    .waitFor();
  await purchaseCard.getByRole("button", { name: "POSSUÍDO", exact: true }).waitFor();

  const purchasedState = await readEconomyState(userId);
  assert.equal(purchasedState.balance, "100");
  assert.equal(purchasedState.purchaseCount, 1);
  assert.equal(purchasedState.ledgerCount, 1);
  assert.equal(purchasedState.ledgerDelta, String(-livePriceOffer.price));
  assert.equal(purchasedState.inventoryIds.length, 4 + livePriceOffer.itemCount);

  const purchasedItems = await readOfferItems(livePriceOffer.id);
  assert.ok(purchasedItems.length > 0, "offer comprada sem itens para equipar");
  const targetItem = purchasedItems[0];
  const stateBeforeEquip = structuredClone(purchasedState);

  await page.goto(`${BASE_URL}/profile/arsenal`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Equipamento do Comandante", exact: true }).waitFor();
  assert.equal(await page.locator('[data-profile-v4-surface="arsenal"]').count(), 1);
  assert.equal(await page.locator('article[data-slot]').count(), 4);

  const ownedCard = page.locator("button").filter({ hasText: targetItem.name }).first();
  await ownedCard.waitFor({ state: "visible" });
  await ownedCard.click();
  const inspector = page.locator("aside[aria-live=\"polite\"]");
  await inspector.getByRole("heading", { name: targetItem.name, exact: true }).waitFor();
  const equipButton = inspector.getByRole("button", { name: "EQUIPAR", exact: true });
  assert.equal(await equipButton.count(), 1);
  await equipButton.click();
  await page.getByText(new RegExp(`${targetItem.name} equipado em`)).waitFor();

  const equippedState = await readEconomyState(userId);
  assert.equal(equippedState.balance, stateBeforeEquip.balance);
  assert.equal(equippedState.purchaseCount, stateBeforeEquip.purchaseCount);
  assert.equal(equippedState.ledgerCount, stateBeforeEquip.ledgerCount);
  assert.equal(equippedState.ledgerDelta, stateBeforeEquip.ledgerDelta);
  assert.equal(
    equippedState.loadout.some(
      (entry) => entry.slot === targetItem.slot && entry.cosmetic_id === targetItem.id,
    ),
    true,
  );

  await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Remessas do Comando", exact: true }).waitFor();
  purchaseCard = offerCard(page, livePriceOffer.name);
  assert.ok((await purchaseCard.getByText("POSSUÍDO", { exact: true }).count()) >= 1);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-purchase-equipped-v4-1440x900.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Remessas do Comando", exact: true }).waitFor();
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-v4-390x844.png"),
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
    `[economy-e2e] ok — Profile V4, ${commerce.offers.length} offers, ${commerce.creditPacks.length} packs, compra/equip persistentes e ${signedR2Keys.length} deliveries R2 validados`,
  );
} finally {
  await context.close();
  await browser.close();
}

process.env.PLAYWRIGHT_RUNTIME_DIR ??= path.resolve("node_modules/playwright");
process.env.LOBBY_E2E_BASE_URL ??= BASE_URL;
process.env.LOBBY_E2E_DATABASE_URL ??= DATABASE_URL;
await import("./economy-purchase-e2e.mjs");
