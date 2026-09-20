import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

test("game invitations are short-lived, friend-scoped room records", async () => {
  const migration = await source("src/lib/db/migrations/managed/052-game-room-invitations.sql");
  const service = await source("src/lib/server/game-invitations/invitation-service.ts");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS game\.room_invitations/);
  assert.match(migration, /room_id BIGINT NOT NULL[\s\S]*REFERENCES game\.rooms\(id\)/);
  assert.match(migration, /INTERVAL '15 minutes'/);
  assert.match(migration, /LEAST\(inviter_user_id,invitee_user_id\)/);
  assert.match(migration, /GREATEST\(inviter_user_id,invitee_user_id\)/);
  assert.match(service, /relationship !== "friend"/);
  assert.match(service, /createRoom/);
  assert.match(service, /joinRoom/);

  const repository = await source(
    "src/lib/server/game-invitations/invitation-repository.ts",
  );
  assert.match(repository, /VALUES\(\$1::bigint,\$2::uuid,\$3::uuid\)/);
  assert.match(repository, /room\.id=\$1::bigint/);
  assert.match(service, /GAME_INVITATION_FRIEND_REQUIRED/);
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


test("game invitation listing exposes both inbox and outbox for future profile actions", async () => {
  const repository = await source(
    "src/lib/server/game-invitations/invitation-repository.ts",
  );
  const service = await source(
    "src/lib/server/game-invitations/invitation-service.ts",
  );
  const route = await source(
    "src/app/api/profile/game-invitations/route.ts",
  );

  assert.match(repository, /listIncomingRoomInvitations/);
  assert.match(repository, /listOutgoingRoomInvitations/);
  assert.match(service, /Promise\.all\(\[[\s\S]*listIncomingRoomInvitations[\s\S]*listOutgoingRoomInvitations/);
  assert.match(route, /listGameInvitations\(session\.user\.id\)/);
});
