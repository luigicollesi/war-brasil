import "server-only";

import type { CommanderActivityDto } from "./profile-domain";
import { pool } from "../db/pool";

export async function getCommanderActivity(
  userId: string,
): Promise<CommanderActivityDto> {
  const result = await pool.query<{
    status: "waiting" | "order_roll" | "playing";
    match_mode: "classic" | "custom";
  }>(
    `SELECT room.status,room.match_mode
       FROM game.players player
       JOIN game.rooms room ON room.id=player.room_id
      WHERE player.user_id=$1::uuid
        AND room.status IN ('waiting','order_roll','playing')
      ORDER BY
        CASE room.status WHEN 'playing' THEN 0 ELSE 1 END,
        room.created_at DESC,
        player.joined_at DESC
      LIMIT 1`,
    [userId],
  );

  const active = result.rows[0];
  if (!active) {
    return { state: "idle", matchMode: null };
  }

  if (active.status === "playing") {
    return { state: "match", matchMode: active.match_mode };
  }

  return { state: "lobby", matchMode: active.match_mode };
}
