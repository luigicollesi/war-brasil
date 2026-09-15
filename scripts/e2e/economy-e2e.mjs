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
      `SELECT COUNT(*)::int AS total
         FROM economy.ledger_entries
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
      inventoryIds: inventory.rows.map((row) => row.id),
      loadout: loadout.rows,
    };
  } finally {
    await db.end();
  }
}

function assertFreshCommanderState(state) {
  assert.equal(state.balance, "0");
  assert.equal(state.ledgerCount, 0);
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
  const card = page.locator("article").filter({ hasText: setName });
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

  const storeWallet = page.locator('[data-currency="campaign-credit"]').first();
  assert.match((await storeWallet.textContent()) ?? "", /◈\s*0/);
  assert.equal(await page.locator('section[aria-labelledby="loadout-title"] article').count(), 4);

  for (const name of [
    "Exército Clássico",
    "Lanças Medievais",
    "Viking",
    "Gato",
    "Cachorro",
    "Futebol",
  ]) {
    await page.getByRole("heading", { name, exact: true }).waitFor();
  }
  assert.equal(await page.getByRole("button", { name: /COMPRAR/i }).count(), 0);
  assert.equal(await page.getByText(/R\$\s*\d/).count(), 0);

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
    `[economy-e2e] ok — ${signedR2Keys.length} WebPs assinados e renderizados somente após interação`,
  );
} finally {
  await context.close();
  await browser.close();
}
