import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const participationService = readFileSync(
  "src/lib/server/game-participation-service.ts",
  "utf8",
);
const participationContract = readFileSync(
  "src/lib/shared/active-participation.ts",
  "utf8",
);
const participationRoute = readFileSync(
  "src/app/api/participation/route.ts",
  "utf8",
);
const participationRuntime = readFileSync(
  "src/components/active-participation-runtime.tsx",
  "utf8",
);
const participationCookie = readFileSync(
  "src/lib/server/auth/active-participation-cookie.ts",
  "utf8",
);
const proxy = readFileSync("src/proxy.ts", "utf8");
const rooms = readFileSync("src/lib/server/rooms.ts", "utf8");
const createRoute = readFileSync("src/app/api/rooms/route.ts", "utf8");
const joinRoute = readFileSync("src/app/api/rooms/join/route.ts", "utf8");
const inviteService = readFileSync(
  "src/lib/server/game-invitations/invitation-service.ts",
  "utf8",
);
const lobby = readFileSync("src/components/lobby-client.tsx", "utf8");
const game = readFileSync("src/components/game-client-v2.tsx", "utf8");

test("participação ativa é autoritativa por conta e serializada antes de room locks", () => {
  assert.match(participationService, /player\.user_id=\$1::uuid/);
  assert.match(participationService, /player\.is_bot=FALSE/);
  assert.match(participationService, /pg_advisory_xact_lock/);
  assert.match(participationService, /hashtextextended/);
  assert.match(participationService, /LIMIT 2/);
  assert.match(participationService, /multiple_active_participations/);

  const createLock = rooms.indexOf("lockActiveParticipationForUser", rooms.indexOf("export async function createRoom"));
  const createInsert = rooms.indexOf("INSERT INTO game.rooms", rooms.indexOf("export async function createRoom"));
  assert.ok(createLock >= 0 && createLock < createInsert);

  const joinStart = rooms.indexOf("export async function joinRoomWithClient");
  const joinLock = rooms.indexOf("lockActiveParticipationForUser", joinStart);
  const roomLock = rooms.indexOf("findRoomForUpdate", joinStart);
  assert.ok(joinLock >= 0 && joinLock < roomLock);

  assert.match(inviteService, /lockActiveParticipationForUser\(client, input\.inviteeUserId\)/);
});

test("resume vincula player_session à conta sem transformar cookie em autoridade", () => {
  assert.match(participationService, /SET player_session=\$2::uuid/);
  assert.match(participationService, /AND user_id=\$4::uuid/);
  assert.match(participationService, /player_session_conflict/);
  assert.match(participationRoute, /getAuthenticatedSession\(request\)/);
  assert.match(participationRoute, /resumeActiveParticipation/);
  assert.match(participationCookie, /httpOnly:\s*true/);
  assert.match(participationCookie, /sameSite:\s*"lax"/);
  assert.match(participationContract, /war_brasil_active_participation/);
  assert.doesNotMatch(proxy, /\bpg\b|DATABASE_URL|authPool/);
});

test("create join e convites atualizam somente o hint de navegação após sucesso", () => {
  assert.match(createRoute, /persistActiveParticipationCookie/);
  assert.match(joinRoute, /persistActiveParticipationCookie/);
  assert.match(inviteService, /GAME_INVITATION_ACTIVE_PARTICIPATION/);
  assert.match(rooms, /assertActiveParticipationAvailable/);
});

test("runtime reconduz navegação e transições lobby-game reconciliam o hint", () => {
  assert.match(participationRuntime, /fetch\("\/api\/participation"/);
  assert.match(participationRuntime, /router\.replace\(target\)/);
  assert.match(proxy, /pathnameMatchesActiveParticipation/);
  assert.match(lobby, /fetch\("\/api\/participation"/);
  assert.match(game, /refreshParticipationTarget/);
  assert.match(game, /fetch\("\/api\/participation"/);
});

test("cleanup de presença é exclusivo de waiting e não cria eviction durante partida", () => {
  assert.match(rooms, /room\.status='waiting'/);
  assert.match(rooms, /staleAfterSeconds = 20/);
  assert.match(rooms, /deleteRoomIfNoHumans/);
  assert.doesNotMatch(
    rooms.slice(
      rooms.indexOf("export async function cleanupStaleWaitingRoomSeats"),
      rooms.indexOf("export async function updateLobbyPlayer"),
    ),
    /room\.status='playing'|room\.status='order_roll'/,
  );
});
