import "server-only";

import { pool } from "./db/pool";
import { publishGameTradeResolution } from "./game-realtime-publisher";

type DeclinedTradeRow = {
  id: string;
  turn_number: number;
  proposer_player_id: string;
  target_player_id: string;
  responder_player_id: string | null;
  actor_player_id: string;
};

export async function publishTradeDeclineResolution(
  roomId: string,
  session: string,
  offerId: unknown,
) {
  if (!/^\d+$/.test(roomId)) return false;
  if (typeof offerId !== "string" || !/^\d+$/.test(offerId)) return false;

  const client = await pool.connect();
  try {
    const row = (
      await client.query<DeclinedTradeRow>(
        `SELECT o.id,o.turn_number,o.proposer_player_id,o.target_player_id,
                o.responder_player_id,p.id actor_player_id
         FROM game_player_trade_offers o
         JOIN room_players p
           ON p.room_id=o.room_id
          AND p.player_session=$3
         WHERE o.room_id=$1
           AND o.id=$2
           AND o.status='declined'`,
        [roomId, offerId, session],
      )
    ).rows[0];

    if (!row) return false;

    if (
      row.actor_player_id === row.target_player_id &&
      row.responder_player_id === null
    ) {
      return publishGameTradeResolution(client, {
        roomId,
        offerId: row.id,
        turnNumber: row.turn_number,
        recipientPlayerId: row.proposer_player_id,
        actorPlayerId: row.actor_player_id,
        outcome: "declined",
      });
    }

    if (
      row.actor_player_id === row.proposer_player_id &&
      row.responder_player_id !== null
    ) {
      return publishGameTradeResolution(client, {
        roomId,
        offerId: row.id,
        turnNumber: row.turn_number,
        recipientPlayerId: row.responder_player_id,
        actorPlayerId: row.actor_player_id,
        outcome: "counter_declined",
      });
    }

    return false;
  } finally {
    client.release();
  }
}
