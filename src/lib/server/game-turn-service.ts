import "server-only";

import type { PoolClient } from "pg";
import { reinforcementFor } from "@/src/lib/game-rules";
import { RoomError } from "@/src/lib/rooms";

export async function beginReinforcementForPlayer(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  const owned = (
    await client.query<{ territory_id: number }>(
      `SELECT territory_id
       FROM game_territories
       WHERE room_id=$1 AND owner_player_id=$2`,
      [roomId, playerId],
    )
  ).rows;

  const reinforcements = reinforcementFor(
    owned.map((territory) => territory.territory_id),
  );

  await client.query(
    `UPDATE game_rooms
     SET phase='reinforcement',reinforcements_remaining=$2
     WHERE id=$1`,
    [roomId, reinforcements],
  );

  return reinforcements;
}

export async function beginPlayerTurnPhase(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  const player = (
    await client.query<{ is_bot: boolean; card_count: number }>(
      `SELECT p.is_bot,
              COUNT(c.id)::int card_count
       FROM room_players p
       LEFT JOIN game_cards c
         ON c.room_id=p.room_id
        AND c.owner_player_id=p.id
        AND c.zone='hand'
       WHERE p.room_id=$1 AND p.id=$2
       GROUP BY p.id,p.is_bot`,
      [roomId, playerId],
    )
  ).rows[0];

  if (!player) {
    throw new RoomError("Jogador do turno não encontrado.", 409);
  }

  await client.query(
    `UPDATE game_player_trade_offers
     SET status='cancelled',resolved_at=NOW()
     WHERE room_id=$1 AND status IN ('open','countered')`,
    [roomId],
  );
  await client.query(
    `UPDATE game_rooms
     SET trade_offers_used=0
     WHERE id=$1`,
    [roomId],
  );
  await client.query(
    `UPDATE room_players
     SET trade_signals_used=0
     WHERE room_id=$1`,
    [roomId],
  );

  if (!player.is_bot && player.card_count > 0) {
    await client.query(
      `UPDATE game_rooms
       SET phase='trade',reinforcements_remaining=0
       WHERE id=$1`,
      [roomId],
    );
    return "trade" as const;
  }

  await beginReinforcementForPlayer(client, roomId, playerId);
  return "reinforcement" as const;
}
