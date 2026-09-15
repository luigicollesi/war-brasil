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

async function readEconomyState(userId) {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
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
  } finally {
    await db.end();
  }
}

async function readCommerceCatalog() {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
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
  } finally {
    await db.end();
  }
}

async function setCampaignCreditBalance(userId, balance) {
  assert.ok(Number.isSafeInteger(balance) && balance >= 0);
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
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
  } finally {
    await db.end();
  }
}

async function setOfferPrice(offerId, price) {
  assert.ok(Number.isSafeInteger(price) && price > 0);
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
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
  } finally {
    await db.end();
  }
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

async function waitForPreviewImage(card) {
  const image = card.getByRole("img");
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
        node.addEventListener(
          "error",
          () => reject(new Error("preview image failed")),
          { once: true },
        );
      });
    });
  } catch (error) {
    const src = await image.getAttribute("src").catch(() => null);
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`preview image failed: ${previewDiagnostics(src, cause)}`);
  }
}

async function inspectSet(page, setName, expectedKey, screenshotName) {
  const catalog = page.locator('section[aria-labelledby="catalog-title"]');
  const card = catalog.locator("article").filter({ hasText: setName });
  await card.getByRole("button", { name: "INSPECIONAR", exact: true }).click();
  await card.locator("[data-preview-detail]").waitFor({ state: "visible" });
  await waitForPreviewImage(card);

  const src = await card.getByRole("img").getAttribute("src");
  assert.ok(src, `${setName} não expôs src de preview`);
  assert.equal(assetKeyFromDeliveryUrl(src), expectedKey);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, screenshotName),
    fullPage: true,
  });

  return card;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: STORAGE_STATE_PATH,
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
  serviceWorkers: "block",
});
const page = await context.newPage();

// Playwright invokes route handlers only for the first URL in a redirect chain.
// Exercise the real authenticated delivery endpoint with maxRedirects=0, assert
// its signed R2 Location, then provide deterministic WebP bytes to the browser.
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
  await page.getByText("Quartel do Comandante", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Abrir Tesouraria", exact: true }).click();
  const treasury = page.locator('[data-currency="campaign-credit"]').last();
  await treasury.waitFor({ state: "visible" });
  assert.match((await treasury.textContent()) ?? "", /0/);
  const treasuryCoin = treasury.locator('[data-campaign-credit-mark="true"]');
  assert.equal(await treasuryCoin.count(), 1);
  assert.match(
    await treasuryCoin.evaluate((node) => getComputedStyle(node).backgroundImage),
    /coin\.svg/,
  );
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "profile-treasury-1440x900.png"),
    fullPage: true,
  });

  await page.locator('[data-station="quartermaster"] > button').click();
  const arsenalLink = page.getByRole("link", { name: "Abrir arsenal", exact: true });
  await arsenalLink.waitFor({ state: "visible" });
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "profile-quartermaster-1440x900.png"),
    fullPage: true,
  });

  await arsenalLink.click();
  await page.waitForURL(`${BASE_URL}/profile/store`);
  await page.getByRole("heading", { name: "Remessas do Comando", exact: true }).waitFor();
  assert.equal(await page.locator('main[data-scene="profile"]').count(), 1);
  assert.equal(deliveryKeys.length, 0, `asset carregado antes de inspeção: ${deliveryKeys}`);
  assert.equal(signedR2Keys.length, 0, `R2 assinado antes de inspeção: ${signedR2Keys}`);

  const commerce = await readCommerceCatalog();
  assert.ok(commerce.offers.length > 0, "catálogo comercial sem offers disponíveis");
  const storeWallet = page.locator('[data-currency="campaign-credit"]').first();
  assert.match(normalizeText(await storeWallet.textContent()), /Créditos de Campanha 0 saldo persistente/i);
  assert.equal(await storeWallet.locator('img[src*="coin.svg"]').count(), 1);
  assert.equal(await page.locator('section[aria-labelledby="loadout-title"] article').count(), 4);

  let offersSection = page.locator('section[aria-labelledby="offers-title"]');
  assert.equal(await offersSection.locator("article").count(), commerce.offers.length);
  for (const offer of commerce.offers) {
    const card = offersSection.locator("article").filter({ hasText: offer.name });
    await card.getByRole("heading", { name: offer.name, exact: true }).waitFor();
    assert.ok(normalizeText(await card.textContent()).includes(formatNumber(offer.price)));
    assert.equal(await card.locator('img[src*="coin.svg"]').count(), 1);
    const buyButton = card.getByRole("button", { name: "COMPRAR", exact: true });
    assert.equal(await buyButton.count(), 1);
    assert.equal(await buyButton.isDisabled(), true, `${offer.id} deveria respeitar saldo zero`);
  }

  const creditsSection = page.locator('section[aria-labelledby="credits-title"]');
  assert.equal(await creditsSection.locator("article").count(), commerce.creditPacks.length);
  for (const pack of commerce.creditPacks) {
    const card = creditsSection.locator("article").filter({ hasText: pack.name });
    await card.getByRole("heading", { name: pack.name, exact: true }).waitFor();
    const cardText = normalizeText(await card.textContent());
    assert.ok(cardText.includes(formatNumber(pack.creditAmount)), `${pack.id} sem quantidade persistida`);
    assert.ok(cardText.includes(normalizeText(formatBrl(pack.priceBrlCents))), `${pack.id} sem preço BRL persistido`);
    assert.equal(await card.locator('img[src*="coin.svg"]').count(), 1);
    const futureButton = card.getByRole("button", { name: "EM BREVE", exact: true });
    assert.equal(await futureButton.count(), 1);
    assert.equal(await futureButton.isDisabled(), true);
  }
  assertFreshCommanderState(await readEconomyState(userId));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-1440x900.png"),
    fullPage: true,
  });

  const exercito = await inspectSet(
    page,
    "Exército Clássico",
    "cosmetics/dice/military-classic/attack.webp",
    "detail-exercito.png",
  );
  assert.deepEqual(deliveryKeys, ["cosmetics/dice/military-classic/attack.webp"]);
  assert.deepEqual(signedR2Keys, deliveryKeys);

  await exercito.getByRole("button", { name: "Defesa", exact: true }).click();
  await waitForPreviewImage(exercito);
  await page.waitForFunction(() =>
    [...document.images].some((image) =>
      image.src.includes(encodeURIComponent("cosmetics/dice/military-classic/defense.webp")),
    ),
  );
  assert.deepEqual(deliveryKeys, [
    "cosmetics/dice/military-classic/attack.webp",
    "cosmetics/dice/military-classic/defense.webp",
  ]);
  assert.deepEqual(signedR2Keys, deliveryKeys);

  const inspectionTargets = [
    ["Lanças Medievais", "cosmetics/dice/medieval-spears/attack.webp", "detail-lancas.png"],
    ["Viking", "cosmetics/dice/viking/attack.webp", "detail-viking.png"],
    ["Gato", "cosmetics/dice/cat/attack.webp", "detail-gato.png"],
    ["Cachorro", "cosmetics/dice/dog/attack.webp", "detail-cachorro.png"],
    ["Futebol", "cosmetics/dice/football/attack.webp", "detail-futebol.png"],
  ];

  for (const [setName, key, screenshot] of inspectionTargets) {
    await inspectSet(page, setName, key, screenshot);
  }

  assert.deepEqual(signedR2Keys, deliveryKeys);
  assert.equal(new Set(deliveryKeys).size, deliveryKeys.length);
  assert.equal(deliveryKeys.length, 7);
  assertFreshCommanderState(await readEconomyState(userId));

  const reEquip = await apiJson(page, "/api/economy/loadout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slot: "dice_attack",
      cosmeticId: "dice.attack.default",
    }),
  });
  assert.equal(reEquip.status, 200, JSON.stringify(reEquip.body));
  assertFreshCommanderState(await readEconomyState(userId));

  const livePriceOffer = commerce.offers[0];
  const probePrice = livePriceOffer.price + 37;
  try {
    await setOfferPrice(livePriceOffer.id, probePrice);
    await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Remessas do Comando", exact: true }).waitFor();
    offersSection = page.locator('section[aria-labelledby="offers-title"]');
    const repricedCard = offersSection.locator("article").filter({ hasText: livePriceOffer.name });
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
  const fundedWallet = page.locator('[data-currency="campaign-credit"]').first();
  assert.ok(normalizeText(await fundedWallet.textContent()).includes(formatNumber(purchaseBalance)));

  offersSection = page.locator('section[aria-labelledby="offers-title"]');
  let purchaseCard = offersSection.locator("article").filter({ hasText: livePriceOffer.name });
  const buyButton = purchaseCard.getByRole("button", { name: "COMPRAR", exact: true });
  assert.equal(await buyButton.isEnabled(), true);
  await buyButton.click();
  await page.getByText(`${livePriceOffer.name} adquirido. O inventário foi atualizado.`, {
    exact: true,
  }).waitFor();
  await purchaseCard.getByRole("button", { name: "POSSUÍDO", exact: true }).waitFor();
  assert.ok(
    normalizeText(await purchaseCard.textContent()).includes(
      `${livePriceOffer.itemCount}/${livePriceOffer.itemCount} possuído`,
    ),
  );
  assert.ok(normalizeText(await fundedWallet.textContent()).includes("100"));

  const purchasedState = await readEconomyState(userId);
  assert.equal(purchasedState.balance, "100");
  assert.equal(purchasedState.purchaseCount, 1);
  assert.equal(purchasedState.ledgerCount, 1);
  assert.equal(purchasedState.ledgerDelta, String(-livePriceOffer.price));
  assert.equal(purchasedState.inventoryIds.length, 4 + livePriceOffer.itemCount);

  const stateBeforeEquip = structuredClone(purchasedState);
  const equipButton = purchaseCard.getByRole("button", { name: "EQUIPAR", exact: true }).first();
  assert.equal(await equipButton.count(), 1);
  await equipButton.click();
  await page.getByText(/equipado em (Ataque|Defesa|Neutro|Território)\./).waitFor();

  const equippedState = await readEconomyState(userId);
  assert.equal(equippedState.balance, stateBeforeEquip.balance);
  assert.equal(equippedState.purchaseCount, stateBeforeEquip.purchaseCount);
  assert.equal(equippedState.ledgerCount, stateBeforeEquip.ledgerCount);
  assert.equal(equippedState.ledgerDelta, stateBeforeEquip.ledgerDelta);
  assert.equal(
    equippedState.loadout.some((entry) => !entry.cosmetic_id.endsWith(".default")),
    true,
  );

  await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Remessas do Comando", exact: true }).waitFor();
  purchaseCard = page
    .locator('section[aria-labelledby="offers-title"] article')
    .filter({ hasText: livePriceOffer.name });
  assert.ok((await purchaseCard.getByText("EQUIPADO", { exact: true }).count()) >= 1);
  assert.equal(
    await purchaseCard.getByRole("button", { name: "POSSUÍDO", exact: true }).count(),
    1,
  );

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-purchase-equipped-1440x900.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/profile/store`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Remessas do Comando", exact: true }).waitFor();
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-390x844.png"),
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
    `[economy-e2e] ok — ${commerce.offers.length} offers, ${commerce.creditPacks.length} packs, compra/equip persistentes e ${signedR2Keys.length} WebPs validados`,
  );
} finally {
  await context.close();
  await browser.close();
}
