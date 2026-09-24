import { withE2EAuthCaptcha } from "./runtime-helper.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { completeCommanderOnboarding } from "./command-access-helper.mjs";

const playwrightRuntimeDir = path.resolve(
  process.env.PLAYWRIGHT_RUNTIME_DIR ?? ".e2e-runtime/node_modules/playwright",
);
const playwright = await import(
  pathToFileURL(path.join(playwrightRuntimeDir, "index.mjs")).href,
);

const BASE_URL = process.env.LOBBY_E2E_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.LOBBY_E2E_DATABASE_URL;
const E2E_PASSWORD = "WarBrasil-E2E-2026!";

if (!DATABASE_URL) {
  throw new Error("LOBBY_E2E_DATABASE_URL é obrigatória.");
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
      return {
        status: response.status,
        body,
        revision: response.headers.get("x-game-revision"),
      };
    },
    { requestUrl: url, requestInit: withE2EAuthCaptcha(url, init) },
  );
}

async function createAuthenticatedActor(browser, db) {
  const identity = `${process.pid}-${Date.now()}`;
  const email = `leave-game-${identity}@e2e.war-brasil.test`;
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
    extraHTTPHeaders: { "x-forwarded-for": "198.51.100.231" },
  });
  const page = await context.newPage();

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

  const verified = await db.query(
    `UPDATE auth."user"
        SET "emailVerified"=TRUE,"updatedAt"=NOW()
      WHERE email=$1
      RETURNING id::text`,
    [email],
  );
  assert.equal(verified.rowCount, 1);

  const signIn = await apiJson(page, "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: E2E_PASSWORD,
      rememberMe: true,
    }),
  });
  assert.equal(signIn.status, 200, JSON.stringify(signIn.body));

  await completeCommanderOnboarding(page, {
    handle: `leave_${identity}`,
    displayName: "Saída E2E",
  });

  return { context, page, userId: verified.rows[0].id };
}

const db = new Client({ connectionString: DATABASE_URL });
await db.connect();
const browser = await playwright.chromium.launch({ headless: true });

try {
  const actor = await createAuthenticatedActor(browser, db);
  try {
    const created = await apiJson(actor.page, "/api/rooms", { method: "POST" });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const code = created.body?.room?.code;
    assert.match(code ?? "", /^[A-Z0-9]{6}$/);

    const addedBot = await apiJson(actor.page, `/api/rooms/${code}/bots`, {
      method: "POST",
    });
    assert.equal(addedBot.status, 201, JSON.stringify(addedBot.body));

    const ready = await apiJson(actor.page, `/api/rooms/${code}/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isReady: true }),
    });
    assert.equal(ready.status, 200, JSON.stringify(ready.body));

    const roomRow = (
      await db.query(
        `SELECT id::text,status,current_match_id::text
           FROM game.rooms
          WHERE code=$1`,
        [code],
      )
    ).rows[0];
    assert.equal(roomRow?.status, "order_roll");
    assert.ok(roomRow?.current_match_id);

    const players = (
      await db.query(
        `SELECT id::text,is_bot
           FROM game.players
          WHERE room_id=$1
          ORDER BY is_bot,joined_at,id`,
        [roomRow.id],
      )
    ).rows;
    const human = players.find((player) => !player.is_bot);
    const bot = players.find((player) => player.is_bot);
    assert.ok(human);
    assert.ok(bot);

    await db.query(
      `UPDATE game.cards
          SET zone='hand',owner_player_id=$2,deck_order=NULL
        WHERE id=(
          SELECT id
          FROM game.cards
          WHERE room_id=$1 AND zone='deck'
          ORDER BY deck_order
          LIMIT 1
        )`,
      [roomRow.id, human.id],
    );

    const snapshot = await apiJson(actor.page, `/api/games/${roomRow.id}`);
    assert.equal(snapshot.status, 200, JSON.stringify(snapshot.body));
    assert.match(snapshot.revision ?? "", /^\d+$/);

    const commandId = randomUUID();
    const commandHeaders = {
      "x-game-command-id": commandId,
      "x-game-expected-revision": snapshot.revision,
    };

    const leave = await apiJson(
      actor.page,
      `/api/games/${roomRow.id}/leave`,
      { method: "POST", headers: commandHeaders },
    );
    assert.equal(leave.status, 200, JSON.stringify(leave.body));

    const replay = await apiJson(
      actor.page,
      `/api/games/${roomRow.id}/leave`,
      { method: "POST", headers: commandHeaders },
    );
    assert.equal(replay.status, 200, JSON.stringify(replay.body));
    assert.deepEqual(replay.body, leave.body);

    const departed = (
      await db.query(
        `SELECT left_at IS NOT NULL AS departed,turn_position
           FROM game.players
          WHERE room_id=$1 AND id=$2`,
        [roomRow.id, human.id],
      )
    ).rows[0];
    assert.equal(departed?.departed, true);
    assert.equal(departed?.turn_position, null);

    const hand = (
      await db.query(
        `SELECT COUNT(*) FILTER (
                  WHERE owner_player_id=$2 AND zone='hand'
                )::int AS human_hand,
                COUNT(*) FILTER (
                  WHERE owner_player_id IS NULL AND zone='discard'
                )::int AS discard_count
           FROM game.cards
          WHERE room_id=$1`,
        [roomRow.id, human.id],
      )
    ).rows[0];
    assert.equal(hand?.human_hand, 0);
    assert.ok((hand?.discard_count ?? 0) >= 1);

    const territoryCounts = (
      await db.query(
        `SELECT owner_player_id::text,COUNT(*)::int AS territory_count,
                SUM(troops)::int AS troop_count
           FROM game.territories
          WHERE room_id=$1
          GROUP BY owner_player_id`,
        [roomRow.id],
      )
    ).rows;
    assert.deepEqual(territoryCounts, [
      {
        owner_player_id: bot.id,
        territory_count: 42,
        troop_count: 42,
      },
    ]);

    const terminal = (
      await db.query(
        `SELECT room.status,room.phase,room.winner_player_id::text,
                match.finished_at IS NOT NULL AS match_finished
           FROM game.rooms room
           JOIN game.matches match
             ON match.id=$2::bigint
          WHERE room.id=$1`,
        [roomRow.id, roomRow.current_match_id],
      )
    ).rows[0];
    assert.equal(terminal?.status, "finished");
    assert.equal(terminal?.phase, "finished");
    assert.equal(terminal?.winner_player_id, bot.id);
    assert.equal(terminal?.match_finished, true);

    const winners = (
      await db.query(
        `SELECT player_id::text
           FROM game.room_winners
          WHERE room_id=$1
          ORDER BY player_id`,
        [roomRow.id],
      )
    ).rows;
    assert.deepEqual(winners, [{ player_id: bot.id }]);

    const historical = (
      await db.query(
        `SELECT player_id_snapshot::text,is_winner
           FROM game.match_participants
          WHERE match_id=$1
          ORDER BY player_id_snapshot`,
        [roomRow.current_match_id],
      )
    ).rows;
    assert.equal(
      historical.find((participant) => participant.player_id_snapshot === human.id)
        ?.is_winner,
      false,
    );
    assert.equal(
      historical.find((participant) => participant.player_id_snapshot === bot.id)
        ?.is_winner,
      true,
    );

    const participation = await apiJson(actor.page, "/api/participation", {
      method: "POST",
    });
    assert.equal(participation.status, 200, JSON.stringify(participation.body));
    assert.equal(participation.body?.participation, null);

    await actor.page.goto(`${BASE_URL}/home`, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(new URL(actor.page.url()).pathname, "/home");

    console.log(
      "[game-player-exit-e2e] saída, retry idempotente, descarte, redistribuição, vitória e liberação confirmados.",
    );
  } finally {
    await actor.context.close();
  }
} finally {
  await browser.close();
  await db.end();
}
