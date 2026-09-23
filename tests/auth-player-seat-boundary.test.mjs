import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const seatGuard = readFileSync(
  "src/lib/server/auth/player-seat-guard.ts",
  "utf8",
);

const directSeatRoutes = [
  "src/app/api/rooms/[code]/route.ts",
  "src/app/api/rooms/[code]/me/route.ts",
  "src/app/api/rooms/[code]/bots/route.ts",
  "src/app/api/rooms/[code]/bots/[botId]/route.ts",
  "src/app/api/games/[roomId]/advance/route.ts",
  "src/app/api/games/[roomId]/realtime-ticket/route.ts",
  "src/app/api/games/[roomId]/trade/route.ts",
  "src/app/api/games/[roomId]/trade/signal/route.ts",
];

const wrappedSeatRoutes = [
  "src/app/api/games/[roomId]/attack/route.ts",
  "src/app/api/games/[roomId]/attack/cancel/route.ts",
  "src/app/api/games/[roomId]/attack/roll/route.ts",
  "src/app/api/games/[roomId]/roll/route.ts",
  "src/app/api/games/[roomId]/rematch/route.ts",
  "src/app/api/games/[roomId]/return-lobby/route.ts",
  "src/app/api/games/[roomId]/cards/trade/route.ts",
  "src/app/api/games/[roomId]/conquest/route.ts",
  "src/app/api/games/[roomId]/maneuver/route.ts",
  "src/app/api/games/[roomId]/phase/route.ts",
  "src/app/api/games/[roomId]/reinforce/route.ts",
];

test("player seat guard exige sessão Better Auth e ownership da mesma conta", () => {
  assert.match(seatGuard, /^import "server-only";/m);
  assert.match(seatGuard, /getAuthenticatedSession\(request\)/);
  assert.match(seatGuard, /player\.player_session = \$2/);
  assert.match(seatGuard, /player\.user_id = \$3/);
  assert.match(seatGuard, /accountSession\.user\.id/);
  assert.match(seatGuard, /player\.is_bot = FALSE/);
  assert.match(seatGuard, /status|RoomError/);
  assert.match(seatGuard, /403/);
});

test("todas as rotas humanas de Lobby e Game validam conta mais assento", () => {
  for (const path of directSeatRoutes) {
    const source = readFileSync(path, "utf8");
    assert.match(
      source,
      /assertAuthenticatedPlayerSeat/,
      `${path} não usa a boundary de ownership da conta`,
    );
    assert.match(
      source,
      /getPlayerSession\(request\)/,
      `${path} perdeu a identidade efêmera do assento`,
    );
  }

  const helper = readFileSync("src/lib/server/game-command-route.ts", "utf8");
  assert.match(helper, /assertAuthenticatedPlayerSeat/);
  assert.match(helper, /getPlayerSession\(request\)/);
  assert.match(helper, /readGameCommandRequestMetadata\(request\)/);
  assert.match(helper, /createGameCommandRoute/);
  assert.match(helper, /createGameJsonCommandRoute/);
  assert.match(helper, /readJsonObject\(request\)/);
  assert.match(helper, /roomErrorResponse\(error,/);

  for (const path of wrappedSeatRoutes) {
    const source = readFileSync(path, "utf8");
    assert.match(
      source,
      /createGame(?:Json)?CommandRoute/,
      `${path} não usa a boundary compartilhada de command route`,
    );
    assert.doesNotMatch(
      source,
      /getPlayerSession\(request\)|assertAuthenticatedPlayerSeat\(|readGameCommandRequestMetadata\(request\)|readJsonObject\(request\)|roomErrorResponse\(error,/,
      `${path} voltou a duplicar o envelope HTTP compartilhado`,
    );
  }
});

test("snapshot GET usa sessão cacheada e valida account+seat na própria query read-only", () => {
  const route = readFileSync(
    "src/app/api/games/[roomId]/route.ts",
    "utf8",
  );
  const snapshot = readFileSync(
    "src/lib/server/game-snapshot-service.ts",
    "utf8",
  );
  const authGuard = readFileSync(
    "src/lib/server/auth/auth-guard.ts",
    "utf8",
  );

  assert.match(route, /getAuthenticatedSessionForRead/);
  assert.doesNotMatch(route, /assertAuthenticatedPlayerSeat/);
  assert.match(route, /accountSession\.user\.id/);
  assert.match(snapshot, /access_player\.player_session=\$2/);
  assert.match(snapshot, /access_player\.user_id=\$3/);
  assert.match(snapshot, /access_player\.is_bot=FALSE/);
  assert.match(authGuard, /getAuthenticatedSessionForRead/);
  assert.match(
    authGuard,
    /getAuthenticatedSessionForRead[\s\S]*auth\.api\.getSession\(\{[\s\S]*headers: request\.headers[\s\S]*\}\)/,
  );
  const readHelper =
    authGuard.match(
      /export async function getAuthenticatedSessionForRead[\s\S]*?\n\}/,
    )?.[0] ?? "";
  assert.doesNotMatch(readHelper, /disableCookieCache/);
});

test("ticket realtime só é emitido depois da validação account+seat", () => {
  const source = readFileSync(
    "src/app/api/games/[roomId]/realtime-ticket/route.ts",
    "utf8",
  );
  const guardIndex = source.indexOf("assertAuthenticatedPlayerSeat");
  const issueIndex = source.indexOf("issueGameRealtimeTicket(roomId, session)");
  assert.ok(guardIndex >= 0 && issueIndex > guardIndex);
});
