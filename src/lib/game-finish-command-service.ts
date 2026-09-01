import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { gameCommand } from "@/src/lib/game-command";
import {
  assignObjectives,
  ObjectiveConfigurationError,
} from "@/src/lib/objectives/objective-assignment-service";
import { RoomError } from "@/src/lib/rooms";

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
       FROM game_rooms
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
       FROM room_players
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
  await client.query("DELETE FROM game_rematch_votes WHERE room_id=$1", [roomId]);
  await client.query("DELETE FROM game_round_events WHERE room_id=$1", [roomId]);
  await client.query("DELETE FROM game_order_rolls WHERE room_id=$1", [roomId]);
  await client.query("DELETE FROM game_cards WHERE room_id=$1", [roomId]);
  await client.query("DELETE FROM game_player_objectives WHERE room_id=$1", [roomId]);
  await client.query("DELETE FROM game_territories WHERE room_id=$1", [roomId]);
}

async function resetRoomToWaiting(client: PoolClient, roomId: string) {
  await clearGameArtifacts(client, roomId);

  await client.query(
    `UPDATE room_players
     SET is_ready=is_bot,turn_position=NULL,bot_next_action_at=NULL,
         card_trade_count=0
     WHERE room_id=$1`,
    [roomId],
  );

  await client.query(
    `UPDATE game_rooms
     SET status='waiting',started_at=NULL,order_roll_round=1,phase='cards',
         current_player_id=NULL,turn_number=1,round_number=1,
         jurassic_tunnel_territory_id=NULL,reinforcements_remaining=0,
         conquered_this_turn=FALSE,trade_count=0,winner_player_id=NULL,
         pending_from_territory_id=NULL,pending_to_territory_id=NULL,last_battle=NULL
     WHERE id=$1`,
    [roomId],
  );
}

async function initializeFreshGame(client: PoolClient, roomId: string) {
  const players = (
    await client.query<FinishPlayer>(
      "SELECT id FROM room_players WHERE room_id=$1 ORDER BY joined_at,id",
      [roomId],
    )
  ).rows;

  if (players.length < MINIMUM_PLAYERS_TO_START) {
    throw new RoomError("São necessários ao menos dois jogadores.", 409);
  }

  const territoryIds = Array.from({ length: 42 }, (_, index) => index + 1);
  for (let index = territoryIds.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [territoryIds[index], territoryIds[swapIndex]] = [
      territoryIds[swapIndex],
      territoryIds[index],
    ];
  }

  const territoryValues: string[] = [];
  const territoryParameters: Array<string | number> = [];
  for (const [index, territoryId] of territoryIds.entries()) {
    const offset = territoryParameters.length;
    territoryValues.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, 1)`,
    );
    territoryParameters.push(
      roomId,
      territoryId,
      players[index % players.length].id,
    );
  }

  await client.query(
    `INSERT INTO game_territories (room_id,territory_id,owner_player_id,troops)
     VALUES ${territoryValues.join(", ")}`,
    territoryParameters,
  );

  try {
    await assignObjectives(client, roomId, players);
  } catch (error) {
    if (error instanceof ObjectiveConfigurationError) {
      throw new RoomError(error.message, 503);
    }
    throw error;
  }

  const deckOrders = Array.from({ length: 44 }, (_, index) => index + 1);
  for (let index = deckOrders.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [deckOrders[index], deckOrders[swapIndex]] = [
      deckOrders[swapIndex], deckOrders[index],
    ];
  }

  const symbols = await client.query<{ territory_id: number; symbol: string }>(
    "SELECT territory_id,symbol FROM territory_card_symbols ORDER BY territory_id",
  );
  if (symbols.rows.length !== 42) {
    throw new RoomError("Os símbolos das cartas de território estão incompletos.", 503);
  }

  for (const [index, card] of symbols.rows.entries()) {
    await client.query(
      `INSERT INTO game_cards (room_id,territory_id,symbol,deck_order)
       VALUES ($1,$2,$3,$4)`,
      [roomId, card.territory_id, card.symbol, deckOrders[index]],
    );
  }

  for (let index = 0; index < 2; index += 1) {
    await client.query(
      `INSERT INTO game_cards (room_id,is_wild,deck_order)
       VALUES ($1,TRUE,$2)`,
      [roomId, deckOrders[42 + index]],
    );
  }

  await client.query(
    `UPDATE game_rooms
     SET status='order_roll',order_roll_round=1,started_at=NULL,phase='cards',
         current_player_id=NULL,turn_number=1,round_number=1,
         jurassic_tunnel_territory_id=NULL,reinforcements_remaining=0,
         conquered_this_turn=FALSE,trade_count=0,winner_player_id=NULL,
         pending_from_territory_id=NULL,pending_to_territory_id=NULL,last_battle=NULL
     WHERE id=$1 AND status='waiting'`,
    [roomId],
  );
}

export async function voteRematchCommand(value: string, session: string) {
  const roomId = normalizeRoomId(value);

  return gameCommand(roomId, async (client) => {
    const room = await loadRoom(client, roomId);
    assertFinished(room);
    const player = await playerFor(client, room.id, session);

    await client.query(
      `INSERT INTO game_rematch_votes(room_id,player_id)
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
         FROM room_players p
         LEFT JOIN game_rematch_votes v
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
      await initializeFreshGame(client, room.id);
    }

    return {
      restarted,
      voteCount,
      requiredCount: humanCount,
    };
  });
}

export async function returnEveryoneToLobbyCommand(
  value: string,
  session: string,
) {
  const roomId = normalizeRoomId(value);

  return gameCommand(roomId, async (client) => {
    const room = await loadRoom(client, roomId);
    assertFinished(room);
    await playerFor(client, room.id, session);

    await resetRoomToWaiting(client, room.id);

    return {
      code: room.code,
    };
  });
}
