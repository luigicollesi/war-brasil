import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const seatGuard = readFileSync(
  "src/lib/server/auth/player-seat-guard.ts",
  "utf8",
);

const seatRoutes = [
  "src/app/api/rooms/[code]/route.ts",
  "src/app/api/rooms/[code]/me/route.ts",
  "src/app/api/rooms/[code]/bots/route.ts",
  "src/app/api/rooms/[code]/bots/[botId]/route.ts",
  "src/app/api/games/[roomId]/route.ts",
  "src/app/api/games/[roomId]/advance/route.ts",
  "src/app/api/games/[roomId]/attack/route.ts",
  "src/app/api/games/[roomId]/attack/cancel/route.ts",
  "src/app/api/games/[roomId]/attack/roll/route.ts",
  "src/app/api/games/[roomId]/cards/trade/route.ts",
  "src/app/api/games/[roomId]/conquest/route.ts",
  "src/app/api/games/[roomId]/maneuver/route.ts",
  "src/app/api/games/[roomId]/phase/route.ts",
  "src/app/api/games/[roomId]/realtime-ticket/route.ts",
  "src/app/api/games/[roomId]/reinforce/route.ts",
  "src/app/api/games/[roomId]/rematch/route.ts",
  "src/app/api/games/[roomId]/return-lobby/route.ts",
  "src/app/api/games/[roomId]/roll/route.ts",
  "src/app/api/games/[roomId]/trade/route.ts",
  "src/app/api/games/[roomId]/trade/signal/route.ts",
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
  for (const path of seatRoutes) {
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
