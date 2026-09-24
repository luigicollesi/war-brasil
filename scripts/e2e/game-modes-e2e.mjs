import { withE2EAuthCaptcha } from "./runtime-helper.mjs";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { completeCommanderOnboarding } from "./command-access-helper.mjs";

const playwrightRuntimeDir = path.resolve(
  process.env.PLAYWRIGHT_RUNTIME_DIR ?? ".e2e-runtime/node_modules/playwright",
);
const playwright = await import(
  pathToFileURL(path.join(playwrightRuntimeDir, "index.mjs")).href
);

const BASE_URL = process.env.LOBBY_E2E_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.LOBBY_E2E_DATABASE_URL;
const ARTIFACT_DIR = path.resolve(
  process.env.GAME_MODES_E2E_ARTIFACT_DIR ?? "test-results/game-modes-eval",
);
const TIMEOUT_MS = 15_000;
const E2E_PASSWORD = "WarBrasil-E2E-2026!";

if (!DATABASE_URL) {
  throw new Error("LOBBY_E2E_DATABASE_URL é obrigatória.");
}

mkdirSync(ARTIFACT_DIR, { recursive: true });

let actorSequence = 0;
const failures = [];

async function step(name, callback) {
  process.stdout.write(`\n[game-modes-e2e] ${name} ... `);
  try {
    await callback();
    console.log("ok");
  } catch (error) {
    failures.push({ name, error });
    console.log("falhou");
    console.error(error);
  }
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
    { requestUrl: url, requestInit: withE2EAuthCaptcha(url, init) },
  );
}

async function verifyEmail(email) {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const result = await db.query(
      `UPDATE auth."user"
          SET "emailVerified"=TRUE,"updatedAt"=NOW()
        WHERE email=$1
        RETURNING id`,
      [email],
    );
    assert.equal(result.rowCount, 1, `conta E2E não encontrada: ${email}`);
  } finally {
    await db.end();
  }
}

async function authenticate(page) {
  actorSequence += 1;
  const identity = `${process.pid}-${actorSequence}`;
  const email = `game-mode-${identity}@e2e.war-brasil.test`;

  await page.goto(`${BASE_URL}/robots.txt`, { waitUntil: "domcontentloaded" });

  const registration = await apiJson(page, "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: E2E_PASSWORD,
      termsAccepted: true,
    }),
  });
  assert.equal(registration.status, 200, JSON.stringify(registration.body));

  await verifyEmail(email);

  const signIn = await apiJson(page, "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: E2E_PASSWORD, rememberMe: true }),
  });
  assert.equal(signIn.status, 200, JSON.stringify(signIn.body));

  await completeCommanderOnboarding(page, {
    handle: `mode_${identity}`,
    displayName: `Modo E2E ${actorSequence}`,
  });
}

async function createActor(browser, viewport = { width: 1440, height: 900 }) {
  const ip = `198.51.100.${actorSequence + 10}`;
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const page = await context.newPage();
  await authenticate(page);
  return { context, page, ip };
}

async function reconnectActor(browser, actor, viewport = { width: 1440, height: 900 }) {
  const storageState = await actor.context.storageState();
  await actor.context.close();
  const context = await browser.newContext({
    viewport,
    storageState,
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
    extraHTTPHeaders: { "x-forwarded-for": actor.ip },
  });
  const page = await context.newPage();
  actor.context = context;
  actor.page = page;
}

async function createRoom(actor) {
  const response = await apiJson(actor.page, "/api/rooms", { method: "POST" });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const room = response.body?.room;
  assert.match(room?.code ?? "", /^[A-Z0-9]{6}$/);
  return room;
}

async function joinRoom(actor, code) {
  const response = await apiJson(actor.page, "/api/rooms/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
}

async function openLobby(actor, code) {
  await actor.page.goto(`${BASE_URL}/lobby/${code}`, { waitUntil: "domcontentloaded" });
  await actor.page.getByRole("heading", { name: "Conselho de operação" }).waitFor({
    state: "visible",
    timeout: TIMEOUT_MS,
  });
}

async function getLobby(actor, code) {
  const response = await apiJson(actor.page, `/api/rooms/${code}`);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

async function patchMe(actor, code, body, expectedStatus = 200) {
  const response = await apiJson(actor.page, `/api/rooms/${code}/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, expectedStatus, JSON.stringify(response.body));
  return response;
}

async function patchSettings(actor, code, body, expectedStatus = 200) {
  const response = await apiJson(actor.page, `/api/rooms/${code}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, expectedStatus, JSON.stringify(response.body));
  return response;
}

async function waitForLobby(actor, code, predicate) {
  const deadline = Date.now() + TIMEOUT_MS;
  let latest = null;
  while (Date.now() < deadline) {
    const response = await apiJson(actor.page, `/api/rooms/${code}`);
    if (response.status === 200) {
      latest = response.body;
      if (predicate(latest)) return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Lobby ${code} não convergiu: ${JSON.stringify(latest)}`);
}

async function waitForRoomState(db, code, predicate) {
  const deadline = Date.now() + TIMEOUT_MS;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await roomState(db, code);
    if (latest && predicate(latest)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Sala ${code} não convergiu: ${JSON.stringify(latest)}`);
}

async function roomState(db, code) {
  const result = await db.query(
    `SELECT r.id::text room_id,r.status,r.phase,r.revision,r.ruleset,
            r.balanced_dice_enabled,r.current_match_id::text,
            m.sequence,m.ruleset_snapshot,m.balanced_dice_enabled_snapshot,
            m.resolved_profile_id,m.finished_at
       FROM game.rooms r
       LEFT JOIN game.matches m ON m.id=r.current_match_id
      WHERE r.code=$1`,
    [code],
  );
  return result.rows[0] ?? null;
}

async function matchHistory(db, code) {
  const result = await db.query(
    `SELECT m.id::text,m.sequence,m.ruleset_snapshot,
            m.balanced_dice_enabled_snapshot,m.resolved_profile_id,m.finished_at
       FROM game.matches m
       JOIN game.rooms r ON r.id=m.room_id
      WHERE r.code=$1
      ORDER BY m.sequence`,
    [code],
  );
  return result.rows;
}

async function objectiveCount(db, code) {
  const result = await db.query(
    `SELECT COUNT(*)::int count
       FROM game.player_objectives o
       JOIN game.rooms r ON r.id=o.room_id
      WHERE r.code=$1`,
    [code],
  );
  return result.rows[0]?.count ?? -1;
}

async function humanReadiness(db, code) {
  const result = await db.query(
    `SELECT p.id::text,p.is_ready
       FROM game.players p
       JOIN game.rooms r ON r.id=p.room_id
      WHERE r.code=$1 AND p.is_bot=FALSE
      ORDER BY p.joined_at,p.id`,
    [code],
  );
  return result.rows;
}

async function markFinished(db, code) {
  const player = await db.query(
    `SELECT p.id::text
       FROM game.players p
       JOIN game.rooms r ON r.id=p.room_id
      WHERE r.code=$1 AND p.is_bot=FALSE
      ORDER BY p.joined_at,p.id
      LIMIT 1`,
    [code],
  );
  const winnerId = player.rows[0]?.id;
  assert.ok(winnerId, `vencedor E2E ausente para ${code}`);

  const result = await db.query(
    `UPDATE game.rooms
        SET status='finished',phase='finished',winner_player_id=$2,
            revision=revision+1
      WHERE code=$1
      RETURNING id::text,revision`,
    [code, winnerId],
  );
  assert.equal(result.rowCount, 1);
  return result.rows[0];
}

async function stabilizeVisual(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      .wb-code-value { font-size: 0 !important; }
      .wb-code-value::after {
        content: "ABC123";
        font-size: 1.35rem;
        letter-spacing: .18em;
      }
    `,
  });
}

async function assertSettingsPanelFits(page) {
  const dialog = page.getByRole("dialog", { name: "Configurações da sala" });
  const metrics = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
    };
  });

  assert.ok(metrics.top >= -1, JSON.stringify(metrics));
  assert.ok(metrics.left >= -1, JSON.stringify(metrics));
  assert.ok(metrics.right <= metrics.viewportWidth + 1, JSON.stringify(metrics));
  assert.ok(metrics.bottom <= metrics.viewportHeight + 1, JSON.stringify(metrics));
  assert.ok(metrics.scrollHeight <= metrics.clientHeight + 1, JSON.stringify(metrics));
  assert.ok(metrics.documentWidth <= metrics.viewportWidth + 1, JSON.stringify(metrics));
}

async function captureSettingsViewports(page, name) {
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
    { width: 390, height: 580 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await stabilizeVisual(page);
    await assertSettingsPanelFits(page);
    await page.screenshot({
      path: path.join(
        ARTIFACT_DIR,
        `${name}-${viewport.width}x${viewport.height}.png`,
      ),
      animations: "disabled",
      fullPage: false,
    });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
}

async function configureSupremacyThroughUi(host, guest, code) {
  await patchMe(guest, code, { isReady: true });
  const guestReady = await waitForLobby(
    guest,
    code,
    (snapshot) => snapshot.me?.isReady === true,
  );
  assert.equal(guestReady.me.isReady, true);

  const settingsButton = host.page.getByRole("button", {
    name: "Configurações da sala",
    exact: true,
  });
  await settingsButton.click();
  const dialog = host.page.getByRole("dialog", { name: "Configurações da sala" });
  await dialog.waitFor({ state: "visible", timeout: TIMEOUT_MS });

  await dialog.getByRole("button", { name: "Supremacia", exact: true }).click();
  const supremacy = await waitForLobby(
    host,
    code,
    (snapshot) => snapshot.room?.ruleset === "supremacy",
  );
  assert.equal(supremacy.room.ruleset, "supremacy");
  assert.equal(
    supremacy.players.filter((player) => !player.isBot).every((player) => !player.isReady),
    true,
  );

  const balanceSwitch = dialog.getByRole("switch", { name: "Sorte balanceada" });
  await balanceSwitch.click();
  const configured = await waitForLobby(
    host,
    code,
    (snapshot) => snapshot.room?.balancedDiceEnabled === false,
  );
  assert.equal(configured.room.balancedDiceEnabled, false);

  await captureSettingsViewports(host.page, "supremacy-settings");
}

async function startTwoPlayerRoom(host, guest, code) {
  await patchMe(host, code, { isReady: true });
  const result = await patchMe(guest, code, { isReady: true });
  assert.notEqual(result.body?.room?.status, "waiting");
}

async function postGameCommand(actor, roomId, command, expectedStatus = 200) {
  const response = await apiJson(actor.page, `/api/games/${roomId}/${command}`, {
    method: "POST",
  });
  assert.equal(response.status, expectedStatus, JSON.stringify(response.body));
  return response.body;
}

async function main() {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  const browser = await playwright.chromium.launch({ headless: true });
  const actors = [];

  try {
    await step("ROOM-CFG defaults, host authority, reset de ready e UX mínima", async () => {
      const host = await createActor(browser);
      const guest = await createActor(browser);
      actors.push(host, guest);

      const room = await createRoom(host);
      await joinRoom(guest, room.code);
      await openLobby(host, room.code);
      await openLobby(guest, room.code);

      const initial = await getLobby(host, room.code);
      assert.equal(initial.room.ruleset, "objective");
      assert.equal(initial.room.balancedDiceEnabled, true);
      assert.equal(initial.canManageRoom, true);

      const guestInitial = await getLobby(guest, room.code);
      assert.equal(guestInitial.canManageRoom, false);
      assert.equal(
        await guest.page
          .getByRole("button", { name: "Configurações da sala", exact: true })
          .count(),
        0,
      );

      await patchSettings(guest, room.code, { ruleset: "supremacy" }, 403);
      await configureSupremacyThroughUi(host, guest, room.code);

      const guestConfigured = await waitForLobby(
        guest,
        room.code,
        (snapshot) =>
          snapshot.room?.ruleset === "supremacy" &&
          snapshot.room?.balancedDiceEnabled === false,
      );
      assert.equal(guestConfigured.room.ruleset, "supremacy");
      assert.equal(guestConfigured.room.balancedDiceEnabled, false);

      await reconnectActor(browser, guest);
      await openLobby(guest, room.code);
      const reconnectSnapshot = await getLobby(guest, room.code);
      assert.equal(reconnectSnapshot.room.ruleset, "supremacy");
      assert.equal(reconnectSnapshot.room.balancedDiceEnabled, false);

      await startTwoPlayerRoom(host, guest, room.code);
      const started = await waitForRoomState(
        db,
        room.code,
        (state) => state.status === "order_roll" && Boolean(state.current_match_id),
      );
      assert.equal(started.ruleset, "supremacy");
      assert.equal(started.balanced_dice_enabled, false);
      assert.equal(started.ruleset_snapshot, "supremacy");
      assert.equal(started.balanced_dice_enabled_snapshot, false);
      assert.equal(started.resolved_profile_id, "uniform-v1");
      assert.equal(await objectiveCount(db, room.code), 0);

      await patchSettings(host, room.code, { ruleset: "objective" }, 409);

      const gameSnapshot = await apiJson(guest.page, `/api/games/${started.room_id}`);
      assert.equal(gameSnapshot.status, 200, JSON.stringify(gameSnapshot.body));
      assert.equal(gameSnapshot.body?.room?.ruleset, "supremacy");
      assert.equal(gameSnapshot.body?.myObjective, null);

      await markFinished(db, room.code);
      const firstMatchId = started.current_match_id;

      const firstVote = await postGameCommand(host, started.room_id, "rematch");
      assert.equal(firstVote.restarted, false);
      const secondVote = await postGameCommand(guest, started.room_id, "rematch");
      assert.equal(secondVote.restarted, true);

      const restarted = await waitForRoomState(
        db,
        room.code,
        (state) =>
          state.status === "order_roll" &&
          Boolean(state.current_match_id) &&
          state.current_match_id !== firstMatchId,
      );
      assert.equal(restarted.ruleset, "supremacy");
      assert.equal(restarted.balanced_dice_enabled, false);
      assert.equal(restarted.ruleset_snapshot, "supremacy");
      assert.equal(restarted.balanced_dice_enabled_snapshot, false);

      const historyAfterRematch = await matchHistory(db, room.code);
      assert.equal(historyAfterRematch.length, 2);
      assert.equal(historyAfterRematch[0].ruleset_snapshot, "supremacy");
      assert.equal(historyAfterRematch[0].balanced_dice_enabled_snapshot, false);
      assert.ok(historyAfterRematch[0].finished_at);
      assert.equal(historyAfterRematch[1].ruleset_snapshot, "supremacy");
      assert.equal(historyAfterRematch[1].balanced_dice_enabled_snapshot, false);

      await markFinished(db, room.code);
      await postGameCommand(host, restarted.room_id, "return-lobby");
      const waitingAgain = await waitForRoomState(
        db,
        room.code,
        (state) => state.status === "waiting" && state.current_match_id === null,
      );
      assert.equal(waitingAgain.ruleset, "supremacy");
      assert.equal(waitingAgain.balanced_dice_enabled, false);

      await patchSettings(host, room.code, {
        ruleset: "objective",
        balancedDiceEnabled: true,
      });
      await startTwoPlayerRoom(host, guest, room.code);
      const thirdMatch = await waitForRoomState(
        db,
        room.code,
        (state) => state.status === "order_roll" && Boolean(state.current_match_id),
      );
      assert.equal(thirdMatch.ruleset_snapshot, "objective");
      assert.equal(thirdMatch.balanced_dice_enabled_snapshot, true);
      assert.ok((await objectiveCount(db, room.code)) > 0);

      const finalHistory = await matchHistory(db, room.code);
      assert.equal(finalHistory.length, 3);
      assert.deepEqual(
        finalHistory.map((match) => match.ruleset_snapshot),
        ["supremacy", "supremacy", "objective"],
      );
      assert.deepEqual(
        finalHistory.map((match) => match.balanced_dice_enabled_snapshot),
        [false, false, true],
      );
    });

    await step("ROOM-CFG corrida settings vs último ready mantém estado atômico", async () => {
      const host = await createActor(browser);
      const guest = await createActor(browser);
      actors.push(host, guest);

      const room = await createRoom(host);
      await joinRoom(guest, room.code);
      await patchMe(host, room.code, { isReady: true });

      const [settingsResponse, readyResponse] = await Promise.all([
        apiJson(host.page, `/api/rooms/${room.code}/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ruleset: "supremacy",
            balancedDiceEnabled: false,
          }),
        }),
        apiJson(guest.page, `/api/rooms/${room.code}/me`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isReady: true }),
        }),
      ]);

      assert.ok([200, 409].includes(settingsResponse.status));
      assert.equal(readyResponse.status, 200, JSON.stringify(readyResponse.body));

      const state = await roomState(db, room.code);
      const readiness = await humanReadiness(db, room.code);

      if (state.status === "waiting") {
        assert.equal(settingsResponse.status, 200);
        assert.equal(state.ruleset, "supremacy");
        assert.equal(state.balanced_dice_enabled, false);
        assert.equal(state.current_match_id, null);
        assert.equal(readiness.every((player) => player.is_ready), false);
      } else {
        assert.equal(state.status, "order_roll");
        assert.equal(settingsResponse.status, 409);
        assert.equal(state.ruleset, "objective");
        assert.equal(state.balanced_dice_enabled, true);
        assert.ok(state.current_match_id);
        assert.equal(state.ruleset_snapshot, "objective");
        assert.equal(state.balanced_dice_enabled_snapshot, true);
      }
    });
  } finally {
    for (const actor of actors) {
      await actor.context.close().catch(() => {});
    }
    await browser.close();
    await db.end();
  }

  if (failures.length > 0) {
    const summary = failures
      .map(({ name, error }) => `${name}: ${error instanceof Error ? error.message : String(error)}`)
      .join("\n");
    throw new Error(`Falhas no E2E de modos de jogo:\n${summary}`);
  }
}

await main();
