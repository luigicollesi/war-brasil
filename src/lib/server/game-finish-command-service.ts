import "server-only";

import type { PoolClient } from "pg";
import { playerGameCommand } from "@/src/lib/game-command";
import type { GameCommandRequestMetadata } from "@/src/lib/game-command-request";
import { finishDiceBalanceMatchForRoom } from "@/src/lib/server/game-dice-balance-service";
import { RoomError } from "@/src/lib/server/room-error";
import { startGame } from "@/src/lib/server/start-game-service";

const MINIMUM_PLAYERS_TO_START = 2;

type FinishRoom = {
  id: string;
  code: string;
  status: "waiting" | "order_roll" | "playing" | "finished";
};

type FinishPlayer = {
  id: string;
};

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

async function loadRoom(client: PoolClient, roomId: string) {
  const room = (
    await client.query<FinishRoom>(
      `SELECT id,code,status
       FROM game.rooms
       WHERE id=$1`,
      [roomId],
    )
  ).rows[0];

  if (!room) throw new RoomError("Partida não encontrada.", 404);
  return room;
}

async function playerFor(
  client: PoolClient,
  roomId: string,
  session: string,
) {
  const player = (
    await client.query<FinishPlayer>(
      `SELECT id
       FROM game.players
       WHERE room_id=$1 AND player_session=$2 AND is_bot=FALSE
       FOR UPDATE`,
      [roomId, session],
    )
  ).rows[0];

  if (!player) {
    throw new RoomError("Você não pertence a esta partida.", 403);
  }

  return player;
}

function assertFinished(room: FinishRoom) {
  if (room.status !== "finished") {
    throw new RoomError("A partida ainda não terminou.", 409);
  }
}

async function clearGameArtifacts(client: PoolClient, roomId: string) {
  await client.query("DELETE FROM ops.command_receipts WHERE room_id=$1", [roomId]);
  await client.query("DELETE FROM game.rematch_votes WHERE room_id=$1", [roomId]);
  await client.query("DELETE FROM game.round_events WHERE room_id=$1", [roomId]);
  await client.query("DELETE FROM game.order_rolls WHERE room_id=$1", [roomId]);
  await client.query("DELETE FROM game.trade_offers WHERE room_id=$1", [roomId]);
  await client.query("DELETE FROM game.cards WHERE room_id=$1", [roomId]);
  await client.query("DELETE FROM game.player_objectives WHERE room_id=$1", [roomId]);
  await client.query("DELETE FROM game.territories WHERE room_id=$1", [roomId]);
}

async function resetRoomToWaiting(client: PoolClient, roomId: string) {
  // Ending the match is part of the same transaction as clearing the old game.
  // A rematch therefore cannot inherit pressure or an active profile snapshot.
  await finishDiceBalanceMatchForRoom(client, roomId);
  await clearGameArtifacts(client, roomId);

  await client.query(
    `UPDATE game.players
     SET is_ready=is_bot,turn_position=NULL,bot_next_action_at=NULL,
         card_trade_count=0,trade_signals_used=0
     WHERE room_id=$1`,
    [roomId],
  );

  await client.query(
    `UPDATE game.rooms
     SET status='waiting',started_at=NULL,order_roll_round=1,
         initial_territory_presentation_started_at=NULL,phase='trade',
         current_player_id=NULL,turn_number=1,round_number=1,
         jurassic_tunnel_territory_id=NULL,reinforcements_remaining=0,
         conquered_this_turn=FALSE,trade_count=0,trade_offers_used=0,
         winner_player_id=NULL,pending_from_territory_id=NULL,
         pending_to_territory_id=NULL,last_battle=NULL
     WHERE id=$1`,
    [roomId],
  );
}

export async function voteRematchCommand(
  value: string,
  session: string,
  metadata?: GameCommandRequestMetadata | null,
) {
  const roomId = normalizeRoomId(value);

  return playerGameCommand(
    roomId,
    session,
    metadata,
    "rematch.vote",
    null,
    async (client) => {
      const room = await loadRoom(client, roomId);
      assertFinished(room);
      const player = await playerFor(client, room.id, session);

      await client.query(
        `INSERT INTO game.rematch_votes(room_id,player_id)
         VALUES($1,$2)
         ON CONFLICT (room_id,player_id) DO NOTHING`,
        [room.id, player.id],
      );

      const counts = (
        await client.query<{
          player_count: number;
          human_count: number;
          vote_count: number;
        }>(
          `SELECT COUNT(*)::int player_count,
                  COUNT(*) FILTER (WHERE p.is_bot=FALSE)::int human_count,
                  COUNT(v.player_id) FILTER (WHERE p.is_bot=FALSE)::int vote_count
           FROM game.players p
           LEFT JOIN game.rematch_votes v
             ON v.room_id=p.room_id AND v.player_id=p.id
           WHERE p.room_id=$1`,
          [room.id],
        )
      ).rows[0];

      const playerCount = counts?.player_count ?? 0;
      const humanCount = counts?.human_count ?? 0;
      const voteCount = counts?.vote_count ?? 0;
      const restarted =
        playerCount >= MINIMUM_PLAYERS_TO_START &&
        humanCount >= 1 &&
        voteCount === humanCount;

      if (restarted) {
        await resetRoomToWaiting(client, room.id);
        await startGame(client, room.id);
      }

      return {
        restarted,
        voteCount,
        requiredCount: humanCount,
      };
    },
  );
}

export async function returnEveryoneToLobbyCommand(
  value: string,
  session: string,
  metadata?: GameCommandRequestMetadata | null,
) {
  const roomId = normalizeRoomId(value);

  return playerGameCommand(
    roomId,
    session,
    metadata,
    "return_lobby",
    null,
    async (client) => {
      const room = await loadRoom(client, roomId);
      assertFinished(room);
      await playerFor(client, room.id, session);

      await resetRoomToWaiting(client, room.id);

      return {
        code: room.code,
      };
    },
  );
}
