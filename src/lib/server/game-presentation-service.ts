import "server-only";

import type { PoolClient } from "pg";
import {
  advanceBattlePresentation,
  type BattleRoomState,
} from "@/src/lib/game-battle-service";
import { gameConditionalCommand } from "@/src/lib/game-command";
import {
  compareOrderRollHistories,
  eligibleOrderPlayerIds,
  orderRollHistories,
  unresolvedOrderPlayerIds,
  type OrderPlayer,
  type OrderRoll,
} from "@/src/lib/game-order-rules";
import type { GameRevision } from "@/src/lib/game-revision";
import { initializeFirstGameRound } from "@/src/lib/game-round-service";
import {
  isInitialTerritoryPresentationDue,
  isOrderRollPresentationDue,
} from "@/src/lib/game-transitions";
import { RoomError } from "@/src/lib/rooms";
import { beginPlayerTurnPhase } from "./game-turn-service";

type PresentationRoom = BattleRoomState & {
  status: "order_roll" | "playing" | "finished";
  order_roll_round: number;
  initial_territory_presentation_started_at: Date | null;
};

type PresentationOrderRoll = OrderRoll & {
  rolled_at: Date;
};

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

async function loadRoom(client: PoolClient, roomId: string) {
  const result = await client.query<PresentationRoom>(
    `SELECT id,status,order_roll_round,initial_territory_presentation_started_at,
            pending_from_territory_id,pending_to_territory_id,last_battle
     FROM game_rooms
     WHERE id=$1`,
    [roomId],
  );

  const room = result.rows[0];
  if (!room) throw new RoomError("Partida não encontrada.", 404);
  return room;
}

async function startPlaying(
  client: PoolClient,
  room: PresentationRoom,
  order: OrderPlayer[],
) {
  for (const [index, player] of order.entries()) {
    await client.query(
      "UPDATE room_players SET turn_position=$1 WHERE id=$2",
      [index + 1, player.id],
    );
  }

  await client.query(
    "UPDATE room_players SET bot_next_action_at=NULL WHERE room_id=$1",
    [room.id],
  );

  const firstRound = await initializeFirstGameRound(client, room.id);

  await client.query(
    `UPDATE game_rooms
     SET status='playing',started_at=NOW(),phase='reinforcement',
         current_player_id=$2,turn_number=1,round_number=$3,
         jurassic_tunnel_territory_id=$4,reinforcements_remaining=0,
         conquered_this_turn=FALSE,trade_offers_used=0
     WHERE id=$1`,
    [
      room.id,
      order[0].id,
      firstRound.roundNumber,
      firstRound.jurassicTunnelDestinationId,
    ],
  );
  await beginPlayerTurnPhase(client, room.id, order[0].id);
}

async function advanceInitialTerritoryPresentation(
  client: PoolClient,
  room: PresentationRoom,
  nowMs: number,
) {
  const startedAt = room.initial_territory_presentation_started_at;
  if (!startedAt || !isInitialTerritoryPresentationDue(startedAt, nowMs)) {
    return false;
  }

  await client.query(
    `UPDATE game_rooms
     SET initial_territory_presentation_started_at=NULL
     WHERE id=$1 AND initial_territory_presentation_started_at IS NOT NULL`,
    [room.id],
  );
  return true;
}

async function advanceOrderRollPresentation(
  client: PoolClient,
  room: PresentationRoom,
  nowMs: number,
) {
  if (room.status !== "order_roll") return false;

  const players = (
    await client.query<OrderPlayer>(
      `SELECT id
       FROM room_players
       WHERE room_id=$1
       ORDER BY joined_at,id`,
      [room.id],
    )
  ).rows;
  const rolls = (
    await client.query<PresentationOrderRoll>(
      `SELECT player_id,roll_round,value,rolled_at
       FROM game_order_rolls
       WHERE room_id=$1
       ORDER BY roll_round,rolled_at`,
      [room.id],
    )
  ).rows;

  const current = eligibleOrderPlayerIds(
    players,
    rolls,
    room.order_roll_round,
  );
  if (!current.length) return false;

  const currentRolls = rolls.filter(
    (roll) =>
      roll.roll_round === room.order_roll_round &&
      current.includes(roll.player_id),
  );
  const allRolled = current.every((playerId) =>
    currentRolls.some((roll) => roll.player_id === playerId),
  );
  const lastRollAt = currentRolls.reduce<Date | null>(
    (latest, roll) =>
      !latest || roll.rolled_at.getTime() > latest.getTime()
        ? roll.rolled_at
        : latest,
    null,
  );

  if (!isOrderRollPresentationDue(allRolled, lastRollAt, nowMs)) {
    return false;
  }

  const historiesByPlayer = orderRollHistories(players, rolls);
  if (unresolvedOrderPlayerIds(historiesByPlayer).length) {
    await client.query(
      `UPDATE game_rooms
       SET order_roll_round=order_roll_round+1
       WHERE id=$1`,
      [room.id],
    );
    return true;
  }

  const order = [...players].sort((a, b) =>
    compareOrderRollHistories(
      historiesByPlayer.get(a.id) ?? [],
      historiesByPlayer.get(b.id) ?? [],
    ),
  );

  if (!order[0]) {
    throw new RoomError("Não foi possível definir a ordem da partida.", 409);
  }

  await startPlaying(client, room, order);
  return true;
}

export async function advanceGamePresentation(
  client: PoolClient,
  roomId: string,
  nowMs = Date.now(),
) {
  const room = await loadRoom(client, roomId);

  if (room.status === "order_roll") {
    if (room.initial_territory_presentation_started_at) {
      return advanceInitialTerritoryPresentation(client, room, nowMs);
    }
    return advanceOrderRollPresentation(client, room, nowMs);
  }
  if (room.status === "playing") {
    return advanceBattlePresentation(client, room, nowMs);
  }
  return false;
}

export async function advanceGamePresentationCommand(
  value: string,
  expectedRevision: GameRevision,
  nowMs = Date.now(),
) {
  const roomId = normalizeRoomId(value);

  return gameConditionalCommand(
    roomId,
    expectedRevision,
    async (client) => ({
      value: null,
      changed: await advanceGamePresentation(client, roomId, nowMs),
    }),
  );
}
