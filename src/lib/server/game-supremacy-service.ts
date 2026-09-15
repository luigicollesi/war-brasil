import "server-only";

import type { PoolClient } from "pg";
import type { ObjectiveEvent } from "@/src/lib/server/game-objective-service";

export async function supremacyVictoryConditionMet(
  client: PoolClient,
  roomId: string,
  playerId: string,
  event: ObjectiveEvent = "any",
) {
  if (event !== "any" && event !== "territory_control_changed") {
    return false;
  }

  const row = (
    await client.query<{ total: number; owned: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE owner_player_id=$2)::int AS owned
       FROM game.territories
       WHERE room_id=$1`,
      [roomId, playerId],
    )
  ).rows[0];

  const total = row?.total ?? 0;
  const owned = row?.owned ?? 0;
  return total > 0 && owned === total;
}
