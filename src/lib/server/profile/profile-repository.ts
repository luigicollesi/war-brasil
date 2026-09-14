import "server-only";

import type { PoolClient } from "pg";
import { pool } from "../db/pool";

export type ProfileQueryable = Pick<PoolClient, "query">;

export type CommanderProfileRow = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  bio: string | null;
  portrait_source: "auth" | "upload" | "catalog" | null;
  portrait_ref: string | null;
  auth_image: string | null;
  last_seen_at: Date | null;
  title_id: string | null;
  title_name: string | null;
  title_rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | null;
  presence_visibility: "public" | "friends" | "private";
  activity_visibility: "public" | "friends" | "private";
  history_visibility: "public" | "friends" | "private";
  friend_request_policy: "everyone" | "friends_of_friends" | "nobody";
};

export type CommanderSearchRow = Pick<
  CommanderProfileRow,
  | "user_id"
  | "handle"
  | "display_name"
  | "portrait_source"
  | "portrait_ref"
  | "auth_image"
  | "title_id"
  | "title_name"
  | "title_rarity"
> & {
  relationship: "none" | "outgoing-request" | "incoming-request" | "friend";
  mutual_contacts: number;
};

const profileProjection = `
  commander.user_id,
  commander.handle,
  commander.display_name,
  commander.bio,
  commander.portrait_source,
  commander.portrait_ref,
  auth_user.image AS auth_image,
  commander.last_seen_at,
  title.id AS title_id,
  title.name AS title_name,
  title.rarity AS title_rarity,
  COALESCE(privacy.presence_visibility, 'friends') AS presence_visibility,
  COALESCE(privacy.activity_visibility, 'friends') AS activity_visibility,
  COALESCE(privacy.history_visibility, 'friends') AS history_visibility,
  COALESCE(privacy.friend_request_policy, 'everyone') AS friend_request_policy
`;

function escapeLikePrefix(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function findCommanderByUserId(
  userId: string,
  db: ProfileQueryable = pool,
): Promise<CommanderProfileRow | null> {
  const result = await db.query<CommanderProfileRow>(
    `SELECT ${profileProjection}
       FROM profile.commanders commander
       JOIN auth."user" auth_user ON auth_user.id=commander.user_id
       LEFT JOIN profile.privacy_settings privacy ON privacy.user_id=commander.user_id
       LEFT JOIN catalog.commander_titles title
         ON title.id=commander.equipped_title_id
      WHERE commander.user_id=$1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function findCommanderByHandle(
  handle: string,
  db: ProfileQueryable = pool,
): Promise<CommanderProfileRow | null> {
  const result = await db.query<CommanderProfileRow>(
    `SELECT ${profileProjection}
       FROM profile.commanders commander
       JOIN auth."user" auth_user ON auth_user.id=commander.user_id
       LEFT JOIN profile.privacy_settings privacy ON privacy.user_id=commander.user_id
       LEFT JOIN catalog.commander_titles title
         ON title.id=commander.equipped_title_id
      WHERE lower(btrim(commander.handle))=lower(btrim($1))`,
    [handle],
  );
  return result.rows[0] ?? null;
}

export async function searchCommanderDirectoryRows(
  actorUserId: string,
  query: string,
  limit = 8,
  db: ProfileQueryable = pool,
): Promise<CommanderSearchRow[]> {
  const prefix = escapeLikePrefix(query.trim());
  const boundedLimit = Math.max(1, Math.min(20, Math.trunc(limit)));
  const result = await db.query<CommanderSearchRow>(
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
       commander.user_id,
       commander.handle,
       commander.display_name,
       commander.portrait_source,
       commander.portrait_ref,
       auth_user.image AS auth_image,
       title.id AS title_id,
       title.name AS title_name,
       title.rarity AS title_rarity,
       CASE
         WHEN friendship.user_a_id IS NOT NULL THEN 'friend'
         WHEN outgoing.id IS NOT NULL THEN 'outgoing-request'
         WHEN incoming.id IS NOT NULL THEN 'incoming-request'
         ELSE 'none'
       END AS relationship,
       (
         SELECT COUNT(*)::int
           FROM actor_friends actor_friend
           JOIN social.friendships mutual
             ON mutual.user_a_id=LEAST(actor_friend.friend_id, commander.user_id)
            AND mutual.user_b_id=GREATEST(actor_friend.friend_id, commander.user_id)
       ) AS mutual_contacts
       FROM profile.commanders commander
       JOIN auth."user" auth_user ON auth_user.id=commander.user_id
       LEFT JOIN catalog.commander_titles title
         ON title.id=commander.equipped_title_id
       LEFT JOIN social.friendships friendship
         ON friendship.user_a_id=LEAST($1::uuid, commander.user_id)
        AND friendship.user_b_id=GREATEST($1::uuid, commander.user_id)
       LEFT JOIN social.friend_requests outgoing
         ON outgoing.requester_id=$1::uuid
        AND outgoing.recipient_id=commander.user_id
        AND outgoing.state='pending'
       LEFT JOIN social.friend_requests incoming
         ON incoming.requester_id=commander.user_id
        AND incoming.recipient_id=$1::uuid
        AND incoming.state='pending'
      WHERE commander.user_id<>$1::uuid
        AND commander.handle IS NOT NULL
        AND commander.display_name IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
            FROM social.blocks block
           WHERE (block.blocker_id=$1::uuid AND block.blocked_id=commander.user_id)
              OR (block.blocker_id=commander.user_id AND block.blocked_id=$1::uuid)
        )
        AND (
          lower(btrim(commander.handle)) LIKE lower($2) || '%' ESCAPE '\\'
          OR lower(btrim(commander.display_name)) LIKE lower($2) || '%' ESCAPE '\\'
        )
      ORDER BY
        CASE WHEN lower(btrim(commander.handle))=lower($3) THEN 0 ELSE 1 END,
        lower(btrim(commander.handle)),
        commander.user_id
      LIMIT $4`,
    [actorUserId, prefix, query.trim(), boundedLimit],
  );
  return result.rows;
}
