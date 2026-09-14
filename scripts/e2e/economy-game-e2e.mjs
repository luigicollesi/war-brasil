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

if (!DATABASE_URL) throw new Error("DATABASE_URL E2E é obrigatória.");
mkdirSync(ARTIFACT_DIR, { recursive: true });

let actorSequence = 0;

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
    extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${70 + actorSequence}` },
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
    extraHTTPHeaders: { "x-forwarded-for": forwardedIp },
  });
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
    assert.equal(hostPublic?.cosmetics?.diceAttack?.assetRef, "/dados/exercito/ataque.svg");
    assert.equal(hostPublic?.cosmetics?.diceNeutral?.cosmeticId, "dice.neutral.viking");
    assert.equal(hostPublic?.cosmetics?.diceNeutral?.assetRef, "/dados/viking/neutro.svg");
    assert.equal(guestPublic?.cosmetics?.diceDefense?.cosmeticId, "dice.defense.lancas");
    assert.equal(guestPublic?.cosmetics?.diceDefense?.assetRef, "/dados/lancas/defesa.svg");

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

    console.log(
      "[economy-game-e2e] ok — multi-client, profile drift e reconnect preservaram snapshot congelado",
    );
  } finally {
    await host.context.close();
    await guest.context.close();
  }
} finally {
  await browser.close();
  await db.end();
}
