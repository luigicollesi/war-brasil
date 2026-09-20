import "server-only";

import { pool } from "../db/pool";
import type { ProfileQueryable } from "./profile-repository";

export type MatchHistoryCursor = Readonly<{
  finishedAt: string;
  matchId: string;
}>;

export type MatchHistoryRow = {
  match_id: string;
  room_code: string;
  sequence: number;
  started_at: Date;
  finished_at: Date;
  match_mode_snapshot: "classic" | "custom" | null;
  is_winner: boolean | null;
};

export type MatchHistoryParticipantRow = {
  match_id: string;
  user_id: string | null;
  display_name_snapshot: string;
  handle_snapshot: string | null;
  faction_name_snapshot: string;
  color_snapshot: string;
  is_bot: boolean;
  is_winner: boolean | null;
  is_friend: boolean;
};

export async function listMatchHistoryRows(
  userId: string,
  cursor: MatchHistoryCursor | null,
  limit: number,
  db: ProfileQueryable = pool,
) {
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const result = await db.query<MatchHistoryRow>(
    `SELECT
       match.id AS match_id,
       room.code AS room_code,
       match.sequence,
       match.started_at,
       match.finished_at,
       match.match_mode_snapshot,
       self.is_winner
     FROM game.match_participants self
     JOIN game.matches match ON match.id=self.match_id
     JOIN game.rooms room ON room.id=match.room_id
     WHERE self.user_id=$1::uuid
       AND match.finished_at IS NOT NULL
       AND (
         $2::timestamptz IS NULL
         OR (match.finished_at, match.id) < ($2::timestamptz, $3::bigint)
       )
     ORDER BY match.finished_at DESC, match.id DESC
     LIMIT $4`,
    [userId, cursor?.finishedAt ?? null, cursor?.matchId ?? null, boundedLimit + 1],
  );
  return result.rows;
}

export async function listMatchParticipantRows(
  actorUserId: string,
  matchIds: readonly string[],
  db: ProfileQueryable = pool,
) {
  if (matchIds.length === 0) return [];

  const result = await db.query<MatchHistoryParticipantRow>(
    `SELECT
       participant.match_id,
       participant.user_id,
       participant.display_name_snapshot,
       participant.handle_snapshot,
       participant.faction_name_snapshot,
       participant.color_snapshot,
       participant.is_bot,
       participant.is_winner,
       CASE
         WHEN participant.user_id IS NULL OR participant.user_id=$1::uuid THEN FALSE
         ELSE EXISTS (
           SELECT 1
             FROM social.friendships friendship
            WHERE friendship.user_a_id=LEAST($1::uuid,participant.user_id)
              AND friendship.user_b_id=GREATEST($1::uuid,participant.user_id)
         )
       END AS is_friend
     FROM game.match_participants participant
     WHERE participant.match_id=ANY($2::bigint[])
     ORDER BY participant.match_id, participant.is_winner DESC NULLS LAST,
              participant.player_id_snapshot`,
    [actorUserId, matchIds],
  );
  return result.rows;
}
