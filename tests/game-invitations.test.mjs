import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

test("game invitations are short-lived, friend-scoped room records", async () => {
  const migration = await source("src/lib/db/migrations/managed/052-game-room-invitations.sql");
  const service = await source("src/lib/server/game-invitations/invitation-service.ts");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS game\.room_invitations/);
  assert.match(migration, /INTERVAL '15 minutes'/);
  assert.match(migration, /LEAST\(inviter_user_id,invitee_user_id\)/);
  assert.match(migration, /GREATEST\(inviter_user_id,invitee_user_id\)/);
  assert.match(service, /relationship !== "friend"/);
  assert.match(service, /createRoom/);
  assert.match(service, /joinRoom/);
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
