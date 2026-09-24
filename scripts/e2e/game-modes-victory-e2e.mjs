import { withE2EAuthCaptcha } from "./runtime-helper.mjs";
import assert from "node:assert/strict";
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
const E2E_PASSWORD = "WarBrasil-E2E-2026!";
const TIMEOUT_MS = 15_000;

if (!DATABASE_URL) {
  throw new Error("LOBBY_E2E_DATABASE_URL é obrigatória.");
}

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
    { requestUrl: url, requestInit: withE2EAuthCaptcha(url, init) },
  );
}

async function verifyEmail(db, email) {
  const result = await db.query(
    `UPDATE auth."user"
        SET "emailVerified"=TRUE,"updatedAt"=NOW()
      WHERE email=$1
      RETURNING id`,
    [email],
  );
  assert.equal(result.rowCount, 1, `conta E2E não encontrada: ${email}`);
}

async function createActor(browser, db) {
  actorSequence += 1;
  const identity = `${process.pid}-${actorSequence}`;
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      "x-forwarded-for": `198.51.100.${100 + actorSequence}`,
    },
  });
  const page = await context.newPage();
  const email = `supremacy-victory-${identity}@e2e.war-brasil.test`;

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

  await verifyEmail(db, email);

  const signIn = await apiJson(page, "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: E2E_PASSWORD, rememberMe: true }),
  });
  assert.equal(signIn.status, 200, JSON.stringify(signIn.body));

  await completeCommanderOnboarding(page, {
    handle: `victory_${identity}`,
    displayName: `Vitória E2E ${actorSequence}`,
  });

  return { context, page };
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

async function patchRoomSettings(actor, code) {
  const response = await apiJson(actor.page, `/api/rooms/${code}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ruleset: "supremacy" }),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
}

async function setReady(actor, code) {
  const response = await apiJson(actor.page, `/api/rooms/${code}/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isReady: true }),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
}

async function waitForStartedRoom(db, code) {
  const deadline = Date.now() + TIMEOUT_MS;
  let latest = null;

  while (Date.now() < deadline) {
    const result = await db.query(
      `SELECT id::text,status,current_match_id::text,ruleset
         FROM game.rooms
        WHERE code=$1`,
      [code],
    );
    latest = result.rows[0] ?? null;
    if (
      latest?.status === "order_roll" &&
      latest.current_match_id &&
      latest.ruleset === "supremacy"
    ) {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Sala ${code} não iniciou em Supremacia: ${JSON.stringify(latest)}`);
}

async function prepareNearTerminalState(db, code) {
  const roomResult = await db.query(
    `SELECT id::text,current_match_id::text
       FROM game.rooms
      WHERE code=$1`,
    [code],
  );
  const room = roomResult.rows[0];
  assert.ok(room?.id);
  assert.ok(room?.current_match_id);

  const players = await db.query(
    `SELECT p.id::text
       FROM game.players p
      WHERE p.room_id=$1 AND p.is_bot=FALSE
      ORDER BY p.joined_at,p.id`,
    [room.id],
  );
  assert.equal(players.rows.length, 2);
  const attackerId = players.rows[0].id;
  const defenderId = players.rows[1].id;

  await db.query(
    `UPDATE game.players
        SET turn_position=CASE
          WHEN id=$2 THEN 1
          WHEN id=$3 THEN 2
          ELSE turn_position
        END,
        bot_next_action_at=NULL
      WHERE room_id=$1`,
    [room.id, attackerId, defenderId],
  );

  await db.query(
    `UPDATE game.territories
        SET owner_player_id=CASE
              WHEN territory_id IN (2,3) THEN $3::bigint
              ELSE $2::bigint
            END,
            troops=CASE WHEN territory_id=1 THEN 5 ELSE 1 END,
            moved_in_turn=0
      WHERE room_id=$1`,
    [room.id, attackerId, defenderId],
  );

  const roomUpdate = await db.query(
    `UPDATE game.rooms
        SET status='playing',phase='attack',started_at=NOW(),
            initial_territory_presentation_started_at=NULL,
            current_player_id=$2,turn_number=1,round_number=1,
            reinforcements_remaining=0,conquered_this_turn=FALSE,
            pending_from_territory_id=NULL,pending_to_territory_id=NULL,
            last_battle=NULL,automation_due_at=NULL,automation_kind=NULL,
            automation_claimed_by=NULL,automation_claimed_until=NULL,
            winner_player_id=NULL,revision=revision+1
      WHERE id=$1
      RETURNING revision`,
    [room.id, attackerId],
  );

  return {
    roomId: room.id,
    matchId: room.current_match_id,
    attackerId,
    defenderId,
    revision: roomUpdate.rows[0].revision,
  };
}

async function injectResolvedBattle(
  db,
  roomId,
  attackerId,
  defenderId,
  defenderTerritoryId,
) {
  const battle = {
    attacker: [6],
    defender: [1],
    attackerLosses: 0,
    defenderLosses: 1,
    conquered: true,
    attackerTerritoryId: 1,
    defenderTerritoryId,
    attackerPlayerId: attackerId,
    defenderPlayerId: defenderId,
    stage: "show_comparison",
    stageStartedAt: "2000-01-01T00:00:00.000Z",
    attackMode: "normal",
    barrierName: null,
  };

  const result = await db.query(
    `UPDATE game.rooms
        SET last_battle=$2::jsonb,
            pending_from_territory_id=NULL,
            pending_to_territory_id=NULL,
            automation_due_at=NULL,
            automation_kind=NULL,
            automation_claimed_by=NULL,
            automation_claimed_until=NULL,
            revision=revision+1
      WHERE id=$1
      RETURNING revision`,
    [roomId, JSON.stringify(battle)],
  );
  return result.rows[0].revision;
}

async function advancePresentation(actor, roomId, expectedRevision) {
  const response = await apiJson(actor.page, `/api/games/${roomId}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision }),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body?.changed, true, JSON.stringify(response.body));
  return response.body.revision;
}

async function readDominanceState(db, roomId, attackerId, defenderId) {
  const result = await db.query(
    `SELECT r.status,r.phase,r.winner_player_id::text,r.current_match_id::text,
            COUNT(*) FILTER (WHERE t.owner_player_id=$2::bigint)::int AS attacker_owned,
            COUNT(*) FILTER (WHERE t.owner_player_id=$3::bigint)::int AS defender_owned,
            COUNT(*)::int AS total
       FROM game.rooms r
       JOIN game.territories t ON t.room_id=r.id
      WHERE r.id=$1
      GROUP BY r.id`,
    [roomId, attackerId, defenderId],
  );
  return result.rows[0];
}

async function main() {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  const browser = await playwright.chromium.launch({ headless: true });
  const actors = [];

  try {
    const host = await createActor(browser, db);
    const guest = await createActor(browser, db);
    actors.push(host, guest);

    const room = await createRoom(host);
    await joinRoom(guest, room.code);
    await patchRoomSettings(host, room.code);
    await setReady(host, room.code);
    await setReady(guest, room.code);

    const started = await waitForStartedRoom(db, room.code);
    const setup = await prepareNearTerminalState(db, room.code);
    assert.equal(setup.roomId, started.id);

    let state = await readDominanceState(
      db,
      setup.roomId,
      setup.attackerId,
      setup.defenderId,
    );
    assert.equal(state.attacker_owned, 40);
    assert.equal(state.defender_owned, 2);
    assert.equal(state.total, 42);
    assert.equal(state.status, "playing");

    const firstBattleRevision = await injectResolvedBattle(
      db,
      setup.roomId,
      setup.attackerId,
      setup.defenderId,
      2,
    );
    await advancePresentation(host, setup.roomId, firstBattleRevision);

    state = await readDominanceState(
      db,
      setup.roomId,
      setup.attackerId,
      setup.defenderId,
    );
    assert.equal(state.attacker_owned, 41);
    assert.equal(state.defender_owned, 1);
    assert.equal(state.total, 42);
    assert.equal(state.status, "playing");
    assert.equal(state.phase, "attack");
    assert.equal(state.winner_player_id, null);
    assert.equal(state.current_match_id, setup.matchId);

    const secondBattleRevision = await injectResolvedBattle(
      db,
      setup.roomId,
      setup.attackerId,
      setup.defenderId,
      3,
    );
    await advancePresentation(host, setup.roomId, secondBattleRevision);

    state = await readDominanceState(
      db,
      setup.roomId,
      setup.attackerId,
      setup.defenderId,
    );
    assert.equal(state.attacker_owned, 42);
    assert.equal(state.defender_owned, 0);
    assert.equal(state.total, 42);
    assert.equal(state.status, "finished");
    assert.equal(state.phase, "finished");
    assert.equal(state.winner_player_id, setup.attackerId);
    assert.equal(state.current_match_id, null);

    const match = await db.query(
      `SELECT ruleset_snapshot,finished_at
         FROM game.matches
        WHERE id=$1`,
      [setup.matchId],
    );
    assert.equal(match.rows[0]?.ruleset_snapshot, "supremacy");
    assert.ok(match.rows[0]?.finished_at);

    const eliminated = await db.query(
      `SELECT turn_position
         FROM game.players
        WHERE room_id=$1 AND id=$2`,
      [setup.roomId, setup.defenderId],
    );
    assert.equal(eliminated.rows[0]?.turn_position, null);

    console.log(
      "[game-modes-victory-e2e] 41/42 não vence; 42/42 finaliza Supremacia corretamente.",
    );
  } finally {
    for (const actor of actors) {
      await actor.context.close().catch(() => {});
    }
    await browser.close();
    await db.end();
  }
}

await main();
