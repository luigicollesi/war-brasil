import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

test("game invitations persist room snapshots and survive room deletion semantics", async () => {
  const migration52 = await source(
    "src/lib/db/migrations/managed/052-game-room-invitations.sql",
  );
  const migration53 = await source(
    "src/lib/db/migrations/managed/053-lobby-presence-notifications.sql",
  );
  const repository = await source(
    "src/lib/server/game-invitations/invitation-repository.ts",
  );

  assert.match(migration52, /CREATE TABLE IF NOT EXISTS game\.room_invitations/);
  assert.match(migration52, /INTERVAL '15 minutes'/);
  assert.match(migration53, /room_code_snapshot VARCHAR\(6\)/);
  assert.match(migration53, /ON DELETE SET NULL/);
  assert.match(migration53, /resolved_reason/);
  assert.match(repository, /room_code_snapshot/);
  assert.match(repository, /findPendingInvitationBetween/);
});

test("game invitation creation is friend-only and idempotent", async () => {
  const service = await source(
    "src/lib/server/game-invitations/invitation-service.ts",
  );

  assert.match(service, /relationship !== "friend"/);
  assert.match(service, /GAME_INVITATION_FRIEND_REQUIRED/);
  assert.match(service, /findPendingInvitationBetween/);
  assert.match(service, /reused: true/);
  assert.match(service, /createRoom/);
});

test("game invitation acceptance joins inside the invitation transaction", async () => {
  const service = await source(
    "src/lib/server/game-invitations/invitation-service.ts",
  );

  assert.match(service, /joinRoomWithClient/);
  assert.match(service, /await client\.query\("BEGIN"\)/);
  assert.match(service, /GAME_INVITATION_ROOM_NOT_FOUND/);
  assert.match(service, /GAME_INVITATION_ROOM_STARTED/);
  assert.match(service, /GAME_INVITATION_ROOM_FULL/);
  assert.match(service, /resolved_reason|room_full|room_started/);
});

test("rejecting invitation creates durable host notification", async () => {
  const service = await source(
    "src/lib/server/game-invitations/invitation-service.ts",
  );
  const repository = await source(
    "src/lib/server/profile/notification-repository.ts",
  );

  assert.match(service, /insertInvitationRejectedNotification/);
  assert.match(repository, /game_invitation_rejected/);
  assert.match(repository, /invitation\.inviter_user_id/);
  assert.match(repository, /invitee\.display_name/);
});

test("game invitation mutations are session-derived and origin protected", async () => {
  const createRoute = await source(
    "src/app/api/profile/commanders/[handle]/game-invitations/route.ts",
  );
  const acceptRoute = await source(
    "src/app/api/profile/game-invitations/[invitationId]/accept/route.ts",
  );
  const rejectRoute = await source(
    "src/app/api/profile/game-invitations/[invitationId]/reject/route.ts",
  );

  for (const route of [createRoute, acceptRoute, rejectRoute]) {
    assert.match(route, /getAuthenticatedSession\(request\)/);
    assert.match(route, /rejectUntrustedMutationOrigin\(request\)/);
    assert.doesNotMatch(route, /body\.userId|payload\.userId|input\.userId/);
  }
});

test("game invitation listing exposes inbox and outbox", async () => {
  const repository = await source(
    "src/lib/server/game-invitations/invitation-repository.ts",
  );
  const service = await source(
    "src/lib/server/game-invitations/invitation-service.ts",
  );

  assert.match(repository, /listIncomingRoomInvitations/);
  assert.match(repository, /listOutgoingRoomInvitations/);
  assert.match(
    service,
    /Promise\.all\(\[[\s\S]*listIncomingRoomInvitations[\s\S]*listOutgoingRoomInvitations/,
  );
});


test("invitation acceptance locks room before invitation to avoid leave/accept deadlocks", async () => {
  const repository = await source(
    "src/lib/server/game-invitations/invitation-repository.ts",
  );
  const service = await source(
    "src/lib/server/game-invitations/invitation-service.ts",
  );
  const rooms = await source("src/lib/server/rooms.ts");

  assert.match(repository, /readIncomingRoomInvitationRoomReference/);
  assert.match(repository, /lockWaitingRoomByInvitationReference/);

  const referenceIndex = service.indexOf("readIncomingRoomInvitationRoomReference");
  const roomLockIndex = service.indexOf("lockWaitingRoomByInvitationReference", referenceIndex);
  const inviteLockIndex = service.indexOf("lockIncomingRoomInvitation", roomLockIndex);
  assert.ok(referenceIndex >= 0);
  assert.ok(roomLockIndex > referenceIndex);
  assert.ok(inviteLockIndex > roomLockIndex);

  assert.match(rooms, /FOR UPDATE OF room,player SKIP LOCKED/);
});
