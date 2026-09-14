import "server-only";

import type { PoolClient } from "pg";
import { pool } from "../db/pool";
import type { ProfileQueryable } from "./profile-repository";

export type SocialRelationship =
  | "none"
  | "outgoing-request"
  | "incoming-request"
  | "friend"
  | "blocked";

export type PendingFriendRequestRow = {
  id: string;
  requester_id: string;
  recipient_id: string;
};

export async function getSocialRelationship(
  actorUserId: string,
  targetUserId: string,
  db: ProfileQueryable = pool,
): Promise<SocialRelationship> {
  const result = await db.query<{
    blocked: boolean;
    friends: boolean;
    outgoing: boolean;
    incoming: boolean;
  }>(
    `SELECT
       EXISTS(
         SELECT 1 FROM social.blocks block
          WHERE (block.blocker_id=$1::uuid AND block.blocked_id=$2::uuid)
             OR (block.blocker_id=$2::uuid AND block.blocked_id=$1::uuid)
       ) AS blocked,
       EXISTS(
         SELECT 1 FROM social.friendships friendship
          WHERE friendship.user_a_id=LEAST($1::uuid,$2::uuid)
            AND friendship.user_b_id=GREATEST($1::uuid,$2::uuid)
       ) AS friends,
       EXISTS(
         SELECT 1 FROM social.friend_requests request
          WHERE request.requester_id=$1::uuid
            AND request.recipient_id=$2::uuid
            AND request.state='pending'
       ) AS outgoing,
       EXISTS(
         SELECT 1 FROM social.friend_requests request
          WHERE request.requester_id=$2::uuid
            AND request.recipient_id=$1::uuid
            AND request.state='pending'
       ) AS incoming`,
    [actorUserId, targetUserId],
  );
  const state = result.rows[0];
  if (state?.blocked) return "blocked";
  if (state?.friends) return "friend";
  if (state?.outgoing) return "outgoing-request";
  if (state?.incoming) return "incoming-request";
  return "none";
}

export async function countMutualFriends(
  actorUserId: string,
  targetUserId: string,
  db: ProfileQueryable = pool,
) {
  const result = await db.query<{ count: number }>(
    `WITH actor_friends AS (
       SELECT CASE
                WHEN friendship.user_a_id=$1::uuid THEN friendship.user_b_id
                ELSE friendship.user_a_id
              END AS friend_id
         FROM social.friendships friendship
        WHERE friendship.user_a_id=$1::uuid
           OR friendship.user_b_id=$1::uuid
     ), target_friends AS (
       SELECT CASE
                WHEN friendship.user_a_id=$2::uuid THEN friendship.user_b_id
                ELSE friendship.user_a_id
              END AS friend_id
         FROM social.friendships friendship
        WHERE friendship.user_a_id=$2::uuid
           OR friendship.user_b_id=$2::uuid
     )
     SELECT COUNT(*)::int AS count
       FROM actor_friends actor
       JOIN target_friends target USING(friend_id)`,
    [actorUserId, targetUserId],
  );
  return result.rows[0]?.count ?? 0;
}

export async function insertFriendRequest(
  client: PoolClient,
  requesterId: string,
  recipientId: string,
) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO social.friend_requests(requester_id,recipient_id)
     VALUES($1,$2)
     RETURNING id`,
    [requesterId, recipientId],
  );
  return result.rows[0].id;
}

export async function lockPendingReceivedRequest(
  client: PoolClient,
  requestId: string,
  recipientId: string,
): Promise<PendingFriendRequestRow | null> {
  const result = await client.query<PendingFriendRequestRow>(
    `SELECT id,requester_id,recipient_id
       FROM social.friend_requests
      WHERE id=$1
        AND recipient_id=$2
        AND state='pending'
      FOR UPDATE`,
    [requestId, recipientId],
  );
  return result.rows[0] ?? null;
}

export async function lockPendingSentRequest(
  client: PoolClient,
  requestId: string,
  requesterId: string,
): Promise<PendingFriendRequestRow | null> {
  const result = await client.query<PendingFriendRequestRow>(
    `SELECT id,requester_id,recipient_id
       FROM social.friend_requests
      WHERE id=$1
        AND requester_id=$2
        AND state='pending'
      FOR UPDATE`,
    [requestId, requesterId],
  );
  return result.rows[0] ?? null;
}

export async function resolveFriendRequest(
  client: PoolClient,
  requestId: string,
  state: "accepted" | "rejected" | "cancelled",
) {
  await client.query(
    `UPDATE social.friend_requests
        SET state=$2, resolved_at=NOW()
      WHERE id=$1 AND state='pending'`,
    [requestId, state],
  );
}

export async function insertCanonicalFriendship(
  client: PoolClient,
  userA: string,
  userB: string,
) {
  await client.query(
    `INSERT INTO social.friendships(user_a_id,user_b_id)
     VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid))
     ON CONFLICT (user_a_id,user_b_id) DO NOTHING`,
    [userA, userB],
  );
}

export async function deleteCanonicalFriendship(
  client: PoolClient,
  userA: string,
  userB: string,
) {
  const result = await client.query(
    `DELETE FROM social.friendships
      WHERE user_a_id=LEAST($1::uuid,$2::uuid)
        AND user_b_id=GREATEST($1::uuid,$2::uuid)`,
    [userA, userB],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function insertBlock(
  client: PoolClient,
  blockerId: string,
  blockedId: string,
) {
  await client.query(
    `INSERT INTO social.blocks(blocker_id,blocked_id)
     VALUES($1,$2)
     ON CONFLICT (blocker_id,blocked_id) DO NOTHING`,
    [blockerId, blockedId],
  );
}

export async function deleteBlock(
  client: PoolClient,
  blockerId: string,
  blockedId: string,
) {
  const result = await client.query(
    `DELETE FROM social.blocks
      WHERE blocker_id=$1 AND blocked_id=$2`,
    [blockerId, blockedId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function cancelPendingRequestsBetween(
  client: PoolClient,
  userA: string,
  userB: string,
) {
  await client.query(
    `UPDATE social.friend_requests
        SET state='cancelled', resolved_at=NOW()
      WHERE state='pending'
        AND (
          (requester_id=$1 AND recipient_id=$2)
          OR (requester_id=$2 AND recipient_id=$1)
        )`,
    [userA, userB],
  );
}
