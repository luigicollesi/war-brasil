import assert from "node:assert/strict";

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

function friendRequest(page, handle) {
  return apiJson(page, "/api/profile/friends/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle }),
  });
}

function cancelRequest(page, requestId) {
  return apiJson(page, `/api/profile/friends/requests/${requestId}`, {
    method: "DELETE",
  });
}

function acceptRequest(page, requestId) {
  return apiJson(page, `/api/profile/friends/requests/${requestId}/accept`, {
    method: "POST",
  });
}

function removeFriend(page, handle) {
  return apiJson(page, `/api/profile/friends/${encodeURIComponent(handle)}`, {
    method: "DELETE",
  });
}

function blockCommander(page, handle) {
  return apiJson(page, "/api/profile/blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle }),
  });
}

function unblockCommander(page, handle) {
  return apiJson(page, `/api/profile/blocks/${encodeURIComponent(handle)}`, {
    method: "DELETE",
  });
}

async function friendshipCount(db, userA, userB) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count
       FROM social.friendships
      WHERE user_a_id=LEAST($1::uuid,$2::uuid)
        AND user_b_id=GREATEST($1::uuid,$2::uuid)`,
    [userA, userB],
  );
  return result.rows[0]?.count ?? 0;
}

async function blockCount(db, blockerId, blockedId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count
       FROM social.blocks
      WHERE blocker_id=$1::uuid AND blocked_id=$2::uuid`,
    [blockerId, blockedId],
  );
  return result.rows[0]?.count ?? 0;
}

async function requestState(db, requestId) {
  const result = await db.query(
    `SELECT state FROM social.friend_requests WHERE id=$1::uuid`,
    [requestId],
  );
  return result.rows[0]?.state ?? null;
}

function oneCreatedOneConflict(results, label) {
  const statuses = results.map((result) => result.status).sort((a, b) => a - b);
  assert.deepEqual(statuses, [201, 409], `${label}: ${JSON.stringify(results)}`);
  const created = results.find((result) => result.status === 201);
  assert.match(created?.body?.requestId ?? "", /^[0-9a-f-]{36}$/i);
  return created.body.requestId;
}

export async function assertProfileSocialFlow({ db, actorA, actorB }) {
  const search = await apiJson(
    actorA.page,
    `/api/profile/commanders/search?q=${encodeURIComponent(actorB.handle)}`,
  );
  assert.equal(search.status, 200, JSON.stringify(search.body));
  const found = search.body?.results?.find((entry) => entry?.handle === actorB.handle);
  assert.ok(found, "busca autenticada não encontrou o segundo comandante");
  assert.deepEqual(
    Object.keys(found).sort(),
    ["displayName", "handle", "mutualContacts", "portrait", "relationship", "title"],
    "busca pública expôs campo além do DTO permitido",
  );

  const selfRequest = await friendRequest(actorA.page, actorA.handle);
  assert.equal(selfRequest.status, 409, JSON.stringify(selfRequest.body));
  assert.equal(selfRequest.body?.error, "SELF_RELATION_NOT_ALLOWED");

  const duplicateId = oneCreatedOneConflict(
    await Promise.all([
      friendRequest(actorA.page, actorB.handle),
      friendRequest(actorA.page, actorB.handle),
    ]),
    "duas criações simultâneas",
  );
  const cancelled = await cancelRequest(actorA.page, duplicateId);
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  assert.equal(cancelled.body?.cancelled, true);

  const cross = await Promise.all([
    friendRequest(actorA.page, actorB.handle),
    friendRequest(actorB.page, actorA.handle),
  ]);
  const requestId = oneCreatedOneConflict(cross, "A→B e B→A simultâneos");
  const aRequested = cross[0].status === 201;
  const requester = aRequested ? actorA : actorB;
  const recipient = aRequested ? actorB : actorA;

  const unauthorized = await acceptRequest(requester.page, requestId);
  assert.equal(unauthorized.status, 404, JSON.stringify(unauthorized.body));
  assert.equal(unauthorized.body?.error, "REQUEST_NOT_FOUND");

  const accepted = await acceptRequest(recipient.page, requestId);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body?.accepted, true);
  assert.equal(accepted.body?.alreadyResolved, false);

  const acceptedAgain = await acceptRequest(recipient.page, requestId);
  assert.equal(acceptedAgain.status, 200, JSON.stringify(acceptedAgain.body));
  assert.equal(acceptedAgain.body?.alreadyResolved, true);
  assert.equal(await friendshipCount(db, actorA.userId, actorB.userId), 1);

  const removed = await removeFriend(requester.page, recipient.handle);
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal(removed.body?.removed, true);
  const removedAgain = await removeFriend(requester.page, recipient.handle);
  assert.equal(removedAgain.status, 200, JSON.stringify(removedAgain.body));
  assert.equal(removedAgain.body?.removed, false);
  assert.equal(await friendshipCount(db, actorA.userId, actorB.userId), 0);

  const recreate = await friendRequest(requester.page, recipient.handle);
  assert.equal(recreate.status, 201, JSON.stringify(recreate.body));
  const reaccepted = await acceptRequest(recipient.page, recreate.body.requestId);
  assert.equal(reaccepted.status, 200, JSON.stringify(reaccepted.body));
  assert.equal(await friendshipCount(db, actorA.userId, actorB.userId), 1);

  const blockedFriend = await blockCommander(recipient.page, requester.handle);
  assert.equal(blockedFriend.status, 201, JSON.stringify(blockedFriend.body));
  assert.equal(await friendshipCount(db, actorA.userId, actorB.userId), 0);
  assert.equal(await blockCount(db, recipient.userId, requester.userId), 1);

  const unblocked = await unblockCommander(recipient.page, requester.handle);
  assert.equal(unblocked.status, 200, JSON.stringify(unblocked.body));
  assert.equal(unblocked.body?.unblocked, true);

  const pending = await friendRequest(requester.page, recipient.handle);
  assert.equal(pending.status, 201, JSON.stringify(pending.body));
  assert.equal(await requestState(db, pending.body.requestId), "pending");

  const blockedPending = await blockCommander(recipient.page, requester.handle);
  assert.equal(blockedPending.status, 201, JSON.stringify(blockedPending.body));
  assert.equal(await requestState(db, pending.body.requestId), "cancelled");

  const denied = await friendRequest(requester.page, recipient.handle);
  assert.equal(denied.status, 403, JSON.stringify(denied.body));
  assert.equal(denied.body?.error, "RELATION_BLOCKED");

  const deniedReverse = await friendRequest(recipient.page, requester.handle);
  assert.equal(deniedReverse.status, 403, JSON.stringify(deniedReverse.body));
  assert.equal(deniedReverse.body?.error, "RELATION_BLOCKED");

  const cleanup = await unblockCommander(recipient.page, requester.handle);
  assert.equal(cleanup.status, 200, JSON.stringify(cleanup.body));
  assert.equal(await blockCount(db, recipient.userId, requester.userId), 0);
}
