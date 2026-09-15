import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
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
  process.env.ECONOMY_GAME_E2E_ARTIFACT_DIR ?? "test-results/economy-game-eval",
);
const ASSET_ROUTE_PATH = "/api/assets/dice";
const FAKE_WEBP = Buffer.from(
  "UklGRhoAAABXRUJQVlA4TA0AAAAvB8ABEAcQERGIiP4HAA==",
  "base64",
);

if (!DATABASE_URL) throw new Error("DATABASE_URL E2E é obrigatória.");
mkdirSync(ARTIFACT_DIR, { recursive: true });

let actorSequence = 0;

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

function assertSignedR2Location(value, expectedKey) {
  const url = new URL(value);
  assert.ok(url.hostname.endsWith(".r2.cloudflarestorage.com"));
  const marker = "/war-brasil-assets-prod/";
  const markerIndex = url.pathname.indexOf(marker);
  assert.ok(markerIndex >= 0, `path R2 inesperado: ${url.pathname}`);
  const objectKey = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  assert.equal(objectKey, expectedKey);
  assert.equal(url.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  assert.match(url.searchParams.get("X-Amz-Credential") ?? "", /\/.+\/s3\/aws4_request$/);
  assert.match(url.searchParams.get("X-Amz-Signature") ?? "", /^[a-f0-9]{64}$/);
  const expires = Number(url.searchParams.get("X-Amz-Expires"));
  assert.ok(Number.isInteger(expires) && expires > 0 && expires <= 900);
}

async function installR2Mock(context) {
  await context.route((url) => url.pathname === ASSET_ROUTE_PATH, async (route) => {
    const expectedKey = assetKeyFromDeliveryUrl(route.request().url());
    const upstream = await route.fetch({ maxRedirects: 0 });
    assert.equal(upstream.status(), 307, `delivery deveria redirecionar ${expectedKey}`);
    const location = upstream.headers().location;
    assert.ok(location, `delivery não retornou Location para ${expectedKey}`);
    assertSignedR2Location(location, expectedKey);
    await route.fulfill({
      status: 200,
      contentType: "image/webp",
      body: FAKE_WEBP,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
}

function expectedDeliveryPath(objectKey) {
  return `/api/assets/dice?key=${encodeURIComponent(objectKey)}`;
}

function normalizedDeliveryPath(value) {
  const url = new URL(value, BASE_URL);
  return `${url.pathname}${url.search}`;
}

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

async function verifyE2eEmail(email) {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const result = await db.query(
      `UPDATE auth."user"
          SET "emailVerified"=TRUE,
              "updatedAt"=NOW()
        WHERE email=$1
        RETURNING id`,
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
  const email = `economy-game-${identity}@e2e.war-brasil.test`;
  const password = `E2e-${identity}-Aa1!`;
  const handle = `econ_game_${process.pid}_${actorSequence}`;
  const displayName = `Economy Game ${label}`;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
    extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${70 + actorSequence}` },
  });
  await installR2Mock(context);
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
    body: JSON.stringify({ handle, displayName }),
  });
  assert.equal(onboarding.status, 200, JSON.stringify(onboarding.body));
  assert.equal(onboarding.body?.profileComplete, true);

  return { context, page, userId, email, handle };
}

async function createRoom(actor) {
  const response = await apiJson(actor.page, "/api/rooms", { method: "POST" });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.match(response.body?.room?.code ?? "", /^[A-Z0-9]{6}$/);
  return response.body.room;
}

async function joinRoom(actor, code) {
  const response = await apiJson(actor.page, "/api/rooms/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
}

async function patchMe(actor, code, body) {
  const response = await apiJson(actor.page, `/api/rooms/${code}/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

async function addBot(actor, code) {
  const response = await apiJson(actor.page, `/api/rooms/${code}/bots`, {
    method: "POST",
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.ok(response.body?.botId, "API de bot não retornou botId");
  return response.body.botId;
}

async function grantOwnedCosmetic(db, userId, cosmeticId, slot) {
  await db.query(
    `UPDATE catalog.cosmetics
        SET status='available'
      WHERE id=$1`,
    [cosmeticId],
  );
  await db.query(
    `INSERT INTO inventory.cosmetics(user_id,cosmetic_id,slot,acquisition_source)
     VALUES($1::uuid,$2,$3,'admin')
     ON CONFLICT (user_id,cosmetic_id) DO NOTHING`,
    [userId, cosmeticId, slot],
  );
}

async function equip(actor, slot, cosmeticId) {
  const response = await apiJson(actor.page, "/api/economy/loadout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot, cosmeticId }),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
}

async function roomDatabaseState(db, code) {
  const result = await db.query(
    `SELECT id::text AS id,status,current_match_id::text AS current_match_id
       FROM game.rooms
      WHERE code=$1`,
    [code],
  );
  return result.rows[0] ?? null;
}

async function waitForStartedRoom(db, code) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const state = await roomDatabaseState(db, code);
    if (state?.status !== "waiting" && state?.current_match_id) return state;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return roomDatabaseState(db, code);
}

function publicCosmetics(snapshot) {
  return snapshot.players
    .map((player) => ({ id: player.id, cosmetics: player.cosmetics }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

function assertNoPrivateEconomyLeak(snapshot) {
  const serialized = JSON.stringify(snapshot);
  for (const forbidden of [
    "campaign-credit",
    "ledger_entries",
    "inventory.cosmetics",
    "currency_code",
    "acquisition_source",
    "user_id",
    "userId",
    "ASSET_STORAGE_URL",
    "E2ESECRETKEY",
  ]) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `snapshot público vazou ${forbidden}`,
    );
  }
}

async function playerIdsByUser(db, roomId, hostUserId, guestUserId) {
  const result = await db.query(
    `SELECT id::text AS id,user_id::text AS user_id
       FROM game.players
      WHERE room_id=$1
        AND user_id=ANY($2::uuid[])
      ORDER BY id`,
    [roomId, [hostUserId, guestUserId]],
  );
  const byUser = new Map(result.rows.map((row) => [row.user_id, row.id]));
  return {
    hostPlayerId: byUser.get(hostUserId),
    guestPlayerId: byUser.get(guestUserId),
  };
}

async function fetchSnapshot(actor, roomId) {
  const result = await apiJson(actor.page, `/api/games/${roomId}`);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.ok(result.body?.players?.length >= 2, "snapshot da partida sem jogadores");
  return result.body;
}

async function reconnectSnapshot(browser, actor, roomId, forwardedIp) {
  const storageState = await actor.context.storageState();
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
    extraHTTPHeaders: { "x-forwarded-for": forwardedIp },
  });
  await installR2Mock(context);
  try {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/robots.txt`, { waitUntil: "domcontentloaded" });
    const response = await apiJson(page, `/api/games/${roomId}`);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body;
  } finally {
    await context.close();
  }
}

async function prepareControlledBattle(db, roomId, attackerPlayerId, defenderPlayerId) {
  await db.query(
    `UPDATE game.players
        SET turn_position=CASE
          WHEN id=$2::bigint THEN 1
          WHEN id=$3::bigint THEN 2
          ELSE turn_position
        END
      WHERE room_id=$1::bigint
        AND id=ANY($4::bigint[])`,
    [roomId, attackerPlayerId, defenderPlayerId, [attackerPlayerId, defenderPlayerId]],
  );

  await db.query(
    `UPDATE game.territories
        SET owner_player_id=CASE
              WHEN territory_id=1 THEN $2::bigint
              ELSE $3::bigint
            END,
            troops=CASE
              WHEN territory_id=1 THEN 6
              ELSE 3
            END
      WHERE room_id=$1::bigint
        AND territory_id IN (1,2)`,
    [roomId, attackerPlayerId, defenderPlayerId],
  );

  await db.query(
    `INSERT INTO game.round_events
       (room_id,round_number,event_id,resolved_effects,applied_troop_changes)
     VALUES($1::bigint,1,0,'[]'::jsonb,'[]'::jsonb)
     ON CONFLICT (room_id,round_number) DO UPDATE
       SET event_id=EXCLUDED.event_id,
           resolved_effects=EXCLUDED.resolved_effects,
           applied_troop_changes=EXCLUDED.applied_troop_changes`,
    [roomId],
  );

  const battle = {
    attackerTerritoryId: 1,
    defenderTerritoryId: 2,
    attackerPlayerId,
    defenderPlayerId,
    stage: "show_comparison",
    stageStartedAt: new Date(Date.now() + 60_000).toISOString(),
    attackMode: "normal",
    barrierName: null,
    attacker: [6, 4, 2],
    defender: [5, 3, 1],
    attackerLosses: 1,
    defenderLosses: 2,
    conquered: false,
  };

  await db.query(
    `UPDATE game.rooms
        SET status='playing',
            phase='attack',
            current_player_id=$2::bigint,
            round_number=1,
            jurassic_tunnel_territory_id=NULL,
            initial_territory_presentation_started_at=NULL,
            pending_from_territory_id=NULL,
            pending_to_territory_id=NULL,
            last_battle=$4::jsonb,
            automation_due_at=NULL,
            automation_kind=NULL,
            automation_claimed_by=NULL,
            automation_claimed_until=NULL
      WHERE id=$1::bigint
        AND current_match_id=$3::bigint`,
    [roomId, attackerPlayerId, (await db.query(
      `SELECT current_match_id FROM game.rooms WHERE id=$1::bigint`,
      [roomId],
    )).rows[0].current_match_id, JSON.stringify(battle)],
  );
}

async function captureBattleEvidence(page, roomId) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/game/${roomId}`, { waitUntil: "domcontentloaded" });

  const modal = page.locator(".battle-modal");
  await modal.waitFor({ state: "visible", timeout: 20_000 });
  const diceGrid = modal.locator(".battle-dice-grid");
  await diceGrid.waitFor({ state: "visible", timeout: 10_000 });

  const attackSrc = await modal.locator(".battle-side--attack img").first().getAttribute("src");
  const defenseSrc = await modal.locator(".battle-side--defense img").first().getAttribute("src");
  assert.equal(
    normalizedDeliveryPath(attackSrc),
    expectedDeliveryPath("cosmetics/dice/military-classic/attack.webp"),
    `dado visual de ataque incorreto: ${attackSrc}`,
  );
  assert.equal(
    normalizedDeliveryPath(defenseSrc),
    expectedDeliveryPath("cosmetics/dice/medieval-spears/defense.webp"),
    `dado visual de defesa incorreto: ${defenseSrc}`,
  );

  await modal.locator(".battle-side--attack img").first().evaluate((image) => {
    if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth <= 0) {
      throw new Error("dado WebP de ataque não carregou");
    }
  });
  await modal.locator(".battle-side--defense img").first().evaluate((image) => {
    if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth <= 0) {
      throw new Error("dado WebP de defesa não carregou");
    }
  });

  await modal.screenshot({
    path: path.join(ARTIFACT_DIR, "battle-distinct-skins-1440x900.png"),
    animations: "disabled",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await modal.waitFor({ state: "visible", timeout: 10_000 });
  await modal.screenshot({
    path: path.join(ARTIFACT_DIR, "battle-distinct-skins-390x844.png"),
    animations: "disabled",
  });
}

async function captureSixColorBoard(page, roomId) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/game/${roomId}`, { waitUntil: "domcontentloaded" });

  const board = page.locator('.game-map-surface[data-map-presentation-active="false"]');
  await board.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(
    () => document.querySelectorAll(".game-troop-layer text").length >= 42,
    undefined,
    { timeout: 20_000 },
  );

  await page.locator(".game-map-canvas").screenshot({
    path: path.join(ARTIFACT_DIR, "six-player-colors-default-effect-1440x900.png"),
    animations: "disabled",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await board.waitFor({ state: "visible", timeout: 10_000 });
  await page.locator(".game-map-canvas").screenshot({
    path: path.join(ARTIFACT_DIR, "six-player-colors-default-effect-390x844.png"),
    animations: "disabled",
  });
}

function assertDefaultBotCosmetics(snapshot) {
  const bots = snapshot.players.filter((player) => player.isBot);
  assert.equal(bots.length, 4, "partida de evidência deveria conter quatro bots");
  for (const bot of bots) {
    assert.equal(bot.cosmetics.diceAttack.cosmeticId, "dice.attack.default");
    assert.equal(bot.cosmetics.diceDefense.cosmeticId, "dice.defense.default");
    assert.equal(bot.cosmetics.diceNeutral.cosmeticId, "dice.neutral.default");
    assert.equal(bot.cosmetics.territoryEffect.cosmeticId, "territory.effect.default");
    assert.equal(
      bot.cosmetics.diceAttack.assetRef,
      expectedDeliveryPath("cosmetics/dice/default/attack.webp"),
    );
    assert.equal(
      bot.cosmetics.diceDefense.assetRef,
      expectedDeliveryPath("cosmetics/dice/default/defense.webp"),
    );
    assert.equal(
      bot.cosmetics.diceNeutral.assetRef,
      expectedDeliveryPath("cosmetics/dice/default/neutral.webp"),
    );
  }
}

const db = new Client({ connectionString: DATABASE_URL });
await db.connect();
const browser = await playwright.chromium.launch({ headless: true });

try {
  const host = await createActor(browser, "Host");
  const guest = await createActor(browser, "Guest");

  try {
    const room = await createRoom(host);
    await joinRoom(guest, room.code);
    await patchMe(host, room.code, { factionName: "Cosmetic Host", color: "forest" });
    await patchMe(guest, room.code, { factionName: "Cosmetic Guest", color: "ruby" });

    await grantOwnedCosmetic(db, host.userId, "dice.attack.exercito", "dice_attack");
    await grantOwnedCosmetic(db, host.userId, "dice.neutral.viking", "dice_neutral");
    await grantOwnedCosmetic(db, guest.userId, "dice.defense.lancas", "dice_defense");

    await equip(host, "dice_attack", "dice.attack.exercito");
    await equip(host, "dice_neutral", "dice.neutral.viking");
    await equip(guest, "dice_defense", "dice.defense.lancas");

    await patchMe(host, room.code, { isReady: true });
    await patchMe(guest, room.code, { isReady: true });

    const state = await waitForStartedRoom(db, room.code);
    assert.ok(state?.id, "sala iniciada sem id");
    assert.ok(state?.current_match_id, "sala iniciada sem current_match_id");
    assert.notEqual(state?.status, "waiting", "sala permaneceu waiting");

    const { hostPlayerId, guestPlayerId } = await playerIdsByUser(
      db,
      state.id,
      host.userId,
      guest.userId,
    );
    assert.ok(hostPlayerId, "seat do host não foi localizado");
    assert.ok(guestPlayerId, "seat do guest não foi localizado");

    const hostInitial = await fetchSnapshot(host, state.id);
    const guestInitial = await fetchSnapshot(guest, state.id);
    assert.deepEqual(
      publicCosmetics(hostInitial),
      publicCosmetics(guestInitial),
      "clientes discordam sobre snapshot cosmético inicial",
    );
    assertNoPrivateEconomyLeak(hostInitial);
    assertNoPrivateEconomyLeak(guestInitial);

    const hostPublic = hostInitial.players.find((player) => player.id === hostPlayerId);
    const guestPublic = hostInitial.players.find((player) => player.id === guestPlayerId);
    assert.equal(hostPublic?.cosmetics?.diceAttack?.cosmeticId, "dice.attack.exercito");
    assert.equal(
      hostPublic?.cosmetics?.diceAttack?.assetRef,
      expectedDeliveryPath("cosmetics/dice/military-classic/attack.webp"),
    );
    assert.equal(hostPublic?.cosmetics?.diceNeutral?.cosmeticId, "dice.neutral.viking");
    assert.equal(
      hostPublic?.cosmetics?.diceNeutral?.assetRef,
      expectedDeliveryPath("cosmetics/dice/viking/neutral.webp"),
    );
    assert.equal(guestPublic?.cosmetics?.diceDefense?.cosmeticId, "dice.defense.lancas");
    assert.equal(
      guestPublic?.cosmetics?.diceDefense?.assetRef,
      expectedDeliveryPath("cosmetics/dice/medieval-spears/defense.webp"),
    );

    const frozen = publicCosmetics(hostInitial);
    writeFileSync(
      path.join(ARTIFACT_DIR, "initial-public-cosmetics.json"),
      `${JSON.stringify(frozen, null, 2)}\n`,
    );

    await equip(host, "dice_attack", "dice.attack.default");
    await equip(host, "dice_neutral", "dice.neutral.default");
    await equip(guest, "dice_defense", "dice.defense.default");

    const hostAfterProfileChange = await fetchSnapshot(host, state.id);
    const guestAfterProfileChange = await fetchSnapshot(guest, state.id);
    assert.deepEqual(publicCosmetics(hostAfterProfileChange), frozen);
    assert.deepEqual(publicCosmetics(guestAfterProfileChange), frozen);

    const hostReconnect = await reconnectSnapshot(
      browser,
      host,
      state.id,
      "198.51.100.91",
    );
    const guestReconnect = await reconnectSnapshot(
      browser,
      guest,
      state.id,
      "198.51.100.92",
    );
    assert.deepEqual(publicCosmetics(hostReconnect), frozen);
    assert.deepEqual(publicCosmetics(guestReconnect), frozen);
    assertNoPrivateEconomyLeak(hostReconnect);
    assertNoPrivateEconomyLeak(guestReconnect);

    const persisted = await db.query(
      `SELECT player_id::text AS player_id,slot,cosmetic_id,asset_ref,effect_key
         FROM game.player_cosmetic_loadouts
        WHERE player_id=ANY($1::bigint[])
        ORDER BY player_id,slot`,
      [[hostPlayerId, guestPlayerId]],
    );
    assert.equal(persisted.rows.length, 8, "snapshot persistido deveria ter quatro slots por jogador");
    const persistedAttack = persisted.rows.find(
      (row) => row.player_id === hostPlayerId && row.slot === "dice_attack",
    );
    const persistedDefense = persisted.rows.find(
      (row) => row.player_id === guestPlayerId && row.slot === "dice_defense",
    );
    assert.equal(persistedAttack?.asset_ref, "cosmetics/dice/military-classic/attack.webp");
    assert.equal(persistedDefense?.asset_ref, "cosmetics/dice/medieval-spears/defense.webp");
    for (const row of persisted.rows.filter((row) => row.slot.startsWith("dice_"))) {
      assert.match(
        row.asset_ref ?? "",
        /^cosmetics\/dice\/[a-z0-9]+(?:-[a-z0-9]+)*\/(attack|defense|neutral)\.webp$/,
      );
    }
    writeFileSync(
      path.join(ARTIFACT_DIR, "persisted-cosmetics.json"),
      `${JSON.stringify(persisted.rows, null, 2)}\n`,
    );

    const financial = await db.query(
      `SELECT wallet.user_id::text AS user_id,
              wallet.balance::text AS balance,
              COUNT(ledger.id)::int AS ledger_count
         FROM economy.wallets wallet
         LEFT JOIN economy.ledger_entries ledger ON ledger.user_id=wallet.user_id
        WHERE wallet.user_id=ANY($1::uuid[])
          AND wallet.currency_code='campaign-credit'
        GROUP BY wallet.user_id,wallet.balance
        ORDER BY wallet.user_id`,
      [[host.userId, guest.userId]],
    );
    assert.equal(financial.rows.length, 2);
    for (const row of financial.rows) {
      assert.equal(row.balance, "0");
      assert.equal(row.ledger_count, 0);
    }

    writeFileSync(
      path.join(ARTIFACT_DIR, "reconnect-public-cosmetics.json"),
      `${JSON.stringify(publicCosmetics(hostReconnect), null, 2)}\n`,
    );

    await prepareControlledBattle(db, state.id, hostPlayerId, guestPlayerId);
    const battleSnapshot = await fetchSnapshot(host, state.id);
    assert.equal(battleSnapshot.room.battle?.stage, "show_comparison");
    assert.equal(
      battleSnapshot.players.find((player) => player.id === hostPlayerId)?.cosmetics?.diceAttack?.cosmeticId,
      "dice.attack.exercito",
    );
    assert.equal(
      battleSnapshot.players.find((player) => player.id === guestPlayerId)?.cosmetics?.diceDefense?.cosmeticId,
      "dice.defense.lancas",
    );
    await captureBattleEvidence(host.page, state.id);

    console.log(
      "[economy-game-e2e] ok — multi-client, profile drift, reconnect e batalha WebP preservaram snapshot congelado",
    );
  } finally {
    await host.context.close();
    await guest.context.close();
  }

  const sixHost = await createActor(browser, "Six Host");
  const sixGuest = await createActor(browser, "Six Guest");
  try {
    const room = await createRoom(sixHost);
    await joinRoom(sixGuest, room.code);
    await patchMe(sixHost, room.code, { factionName: "Six Forest", color: "forest" });
    await patchMe(sixGuest, room.code, { factionName: "Six Ruby", color: "ruby" });

    for (let index = 0; index < 4; index += 1) {
      await addBot(sixHost, room.code);
    }

    const waiting = await apiJson(sixHost.page, `/api/rooms/${room.code}`);
    assert.equal(waiting.status, 200, JSON.stringify(waiting.body));
    assert.equal(waiting.body?.players?.length, 6, "lobby deveria conter seis jogadores");
    const waitingColors = new Set(waiting.body.players.map((player) => player.color));
    assert.deepEqual(
      [...waitingColors].sort(),
      ["forest", "ocean", "orange", "ruby", "sun", "violet"],
      "as seis PlayerColor não foram ocupadas",
    );

    await patchMe(sixHost, room.code, { isReady: true });
    await patchMe(sixGuest, room.code, { isReady: true });

    const state = await waitForStartedRoom(db, room.code);
    assert.ok(state?.id, "sala de seis jogadores iniciada sem id");
    assert.ok(state?.current_match_id, "sala de seis jogadores sem match");

    const snapshot = await fetchSnapshot(sixHost, state.id);
    assert.equal(snapshot.players.length, 6, "snapshot deveria conter seis jogadores");
    assertDefaultBotCosmetics(snapshot);
    assert.equal(
      new Set(snapshot.players.map((player) => player.color)).size,
      6,
      "snapshot não preservou as seis cores distintas",
    );

    writeFileSync(
      path.join(ARTIFACT_DIR, "six-player-public-cosmetics.json"),
      `${JSON.stringify(
        snapshot.players.map((player) => ({
          id: player.id,
          isBot: player.isBot,
          color: player.color,
          cosmetics: player.cosmetics,
        })),
        null,
        2,
      )}\n`,
    );

    await db.query(
      `UPDATE game.rooms
          SET initial_territory_presentation_started_at=NOW() - INTERVAL '60 seconds'
        WHERE id=$1::bigint`,
      [state.id],
    );

    await captureSixColorBoard(sixHost.page, state.id);
    console.log(
      "[economy-game-e2e] ok — 2 humanos + 4 bots preservaram seis PlayerColor e defaults WebP",
    );
  } finally {
    await sixHost.context.close();
    await sixGuest.context.close();
  }
} finally {
  await browser.close();
  await db.end();
}
