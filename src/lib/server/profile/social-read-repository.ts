import "server-only";

import { pool } from "../db/pool";
import type { ProfileQueryable } from "./profile-repository";

export type SocialFriendRow = {
  user_id: string;
  handle: string;
  display_name: string;
  portrait_ref: string | null;
  auth_image: string | null;
  last_seen_at: Date | null;
  title_name: string | null;
  presence_visibility: "public" | "friends" | "private";
  activity_visibility: "public" | "friends" | "private";
  active_room_status: "waiting" | "order_roll" | "playing" | null;
  active_match_mode: "classic" | "custom" | null;
};

export type IncomingFriendRequestReadRow = {
  id: string;
  requester_id: string;
  handle: string;
  display_name: string;
  title_name: string | null;
  mutual_contacts: number;
};

export type OutgoingFriendRequestReadRow = {
  id: string;
  recipient_id: string;
  handle: string;
  display_name: string;
  title_name: string | null;
};

export type BlockedCommanderReadRow = {
  blocked_id: string;
  handle: string;
  display_name: string;
  title_name: string | null;
};

export async function countFriends(
  userId: string,
  db: ProfileQueryable = pool,
) {
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
       FROM social.friendships friendship
      WHERE friendship.user_a_id=$1::uuid
         OR friendship.user_b_id=$1::uuid`,
    [userId],
  );
  return result.rows[0]?.count ?? 0;
}

export async function listFriendRows(
  userId: string,
  limit = 20,
  db: ProfileQueryable = pool,
) {
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const result = await db.query<SocialFriendRow>(
    `WITH friend_ids AS (
       SELECT CASE
                WHEN friendship.user_a_id=$1::uuid THEN friendship.user_b_id
                ELSE friendship.user_a_id
              END AS friend_id
         FROM social.friendships friendship
        WHERE friendship.user_a_id=$1::uuid
           OR friendship.user_b_id=$1::uuid
     )
     SELECT
       commander.user_id,
       commander.handle,
       commander.display_name,
       commander.portrait_ref,
       auth_user.image AS auth_image,
       commander.last_seen_at,
       title.name AS title_name,
       COALESCE(privacy.presence_visibility,'friends') AS presence_visibility,
       COALESCE(privacy.activity_visibility,'friends') AS activity_visibility,
       active.status AS active_room_status,
       active.match_mode AS active_match_mode
       FROM friend_ids ids
       JOIN profile.commanders commander ON commander.user_id=ids.friend_id
       JOIN auth."user" auth_user ON auth_user.id=commander.user_id
       LEFT JOIN profile.privacy_settings privacy ON privacy.user_id=commander.user_id
       LEFT JOIN catalog.commander_titles title ON title.id=commander.equipped_title_id
       LEFT JOIN LATERAL (
         SELECT room.status,room.match_mode
           FROM game.players player
           JOIN game.rooms room ON room.id=player.room_id
          WHERE player.user_id=commander.user_id
            AND room.status IN ('waiting','order_roll','playing')
          ORDER BY
            CASE room.status WHEN 'playing' THEN 0 ELSE 1 END,
            room.created_at DESC,
            player.joined_at DESC
          LIMIT 1
       ) active ON TRUE
      WHERE commander.handle IS NOT NULL
        AND commander.display_name IS NOT NULL
      ORDER BY lower(btrim(commander.display_name)),commander.user_id
      LIMIT $2`,
    [userId, boundedLimit],
  );
  return result.rows;
}

export async function listIncomingFriendRequestRows(
  userId: string,
  limit = 20,
  db: ProfileQueryable = pool,
) {
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const result = await db.query<IncomingFriendRequestReadRow>(
    `WITH actor_friends AS (
       SELECT CASE
                WHEN friendship.user_a_id=$1::uuid THEN friendship.user_b_id
                ELSE friendship.user_a_id
              END AS friend_id
         FROM social.friendships friendship
        WHERE friendship.user_a_id=$1::uuid
           OR friendship.user_b_id=$1::uuid
     )
     SELECT
       request.id,
       request.requester_id,
       commander.handle,
       commander.display_name,
       title.name AS title_name,
       (
         SELECT COUNT(*)::int
           FROM actor_friends actor_friend
           JOIN social.friendships mutual
             ON mutual.user_a_id=LEAST(actor_friend.friend_id,request.requester_id)
            AND mutual.user_b_id=GREATEST(actor_friend.friend_id,request.requester_id)
       ) AS mutual_contacts
       FROM social.friend_requests request
       JOIN profile.commanders commander ON commander.user_id=request.requester_id
       LEFT JOIN catalog.commander_titles title ON title.id=commander.equipped_title_id
      WHERE request.recipient_id=$1::uuid
        AND request.state='pending'
        AND commander.handle IS NOT NULL
        AND commander.display_name IS NOT NULL
      ORDER BY request.created_at DESC,request.id DESC
      LIMIT $2`,
    [userId, boundedLimit],
  );
  return result.rows;
}

export async function listOutgoingFriendRequestRows(
  userId: string,
  limit = 20,
  db: ProfileQueryable = pool,
) {
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const result = await db.query<OutgoingFriendRequestReadRow>(
    `SELECT
       request.id,
       request.recipient_id,
       commander.handle,
       commander.display_name,
       title.name AS title_name
       FROM social.friend_requests request
       JOIN profile.commanders commander ON commander.user_id=request.recipient_id
       LEFT JOIN catalog.commander_titles title ON title.id=commander.equipped_title_id
      WHERE request.requester_id=$1::uuid
        AND request.state='pending'
        AND commander.handle IS NOT NULL
        AND commander.display_name IS NOT NULL
      ORDER BY request.created_at DESC,request.id DESC
      LIMIT $2`,
    [userId, boundedLimit],
  );
  return result.rows;
}

export async function listBlockedCommanderRows(
  userId: string,
  limit = 20,
  db: ProfileQueryable = pool,
) {
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const result = await db.query<BlockedCommanderReadRow>(
    `SELECT
       block.blocked_id,
       commander.handle,
       commander.display_name,
       title.name AS title_name
       FROM social.blocks block
       JOIN profile.commanders commander ON commander.user_id=block.blocked_id
       LEFT JOIN catalog.commander_titles title ON title.id=commander.equipped_title_id
      WHERE block.blocker_id=$1::uuid
        AND commander.handle IS NOT NULL
        AND commander.display_name IS NOT NULL
      ORDER BY block.created_at DESC,block.blocked_id
      LIMIT $2`,
    [userId, boundedLimit],
  );
  return result.rows;
}
