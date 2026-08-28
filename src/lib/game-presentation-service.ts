import "server-only";

import type { PoolClient } from "pg";
import {
  advanceBattlePresentation,
  type BattleRoomState,
} from "@/src/lib/game-battle-service";
import { gameConditionalCommand } from "@/src/lib/game-command";
import { type GameRevision } from "@/src/lib/game-revision";
import { initializeFirstGameRound } from "@/src/lib/game-round-service";
import { isOrderRollPresentationDue } from "@/src/lib/game-transitions";
import { RoomError } from "@/src/lib/rooms";

type PresentationRoom = BattleRoomState & {
  status: "order_roll" | "playing" | "finished";
  order_roll_round: number;
};

type OrderPlayer = {
  id: string;
};

type OrderRoll = {
  player_id: string;
  roll_round: number;
  value: number;
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
    `SELECT id,status,order_roll_round,pending_from_territory_id,
            pending_to_territory_id,last_battle
     FROM game_rooms
     WHERE id=$1`,
    [roomId],
  );

  const room = result.rows[0];
  if (!room) throw new RoomError("Partida não encontrada.", 404);
  return room;
}

function histories(players: OrderPlayer[], rolls: OrderRoll[]) {
  const values = new Map(players.map((player) => [player.id, [] as number[]]));
  for (const roll of rolls) values.get(roll.player_id)?.push(roll.value);
  return values;
}

function unresolved(values: Map<string, number[]>) {
  const groups = new Map<string, string[]>();

  for (const [id, history] of values) {
    const key = history.join(",");
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .flat();
}

function eligible(players: OrderPlayer[], rolls: OrderRoll[], round: number) {
  return unresolved(
    histories(
      players,
      rolls.filter((roll) => roll.roll_round < round),
    ),
  );
}

function compareRollHistory(a: number[], b: number[]) {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (b[index] ?? -1) - (a[index] ?? -1);
    if (difference) return difference;
  }
  return 0;
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

  const firstRound = await initializeFirstGameRound(client, room.id);

  await client.query(
    `UPDATE game_rooms
     SET status='playing',started_at=NOW(),phase='cards',
         current_player_id=$2,turn_number=1,round_number=$3,
         jurassic_tunnel_territory_id=$4,reinforcements_remaining=0,
         conquered_this_turn=FALSE
     WHERE id=$1`,
    [
      room.id,
      order[0].id,
      firstRound.roundNumber,
      firstRound.jurassicTunnelDestinationId,
    ],
  );
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
       ORDER BY joined_at`,
      [room.id],
    )
  ).rows;
  const rolls = (
    await client.query<OrderRoll>(
      `SELECT player_id,roll_round,value,rolled_at
       FROM game_order_rolls
       WHERE room_id=$1
       ORDER BY roll_round,rolled_at`,
      [room.id],
    )
  ).rows;

  const current = eligible(players, rolls, room.order_roll_round);
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

  const historiesByPlayer = histories(players, rolls);
  if (unresolved(historiesByPlayer).length) {
    await client.query(
      `UPDATE game_rooms
       SET order_roll_round=order_roll_round+1
       WHERE id=$1`,
      [room.id],
    );
    return true;
  }

  const order = [...players].sort((a, b) =>
    compareRollHistory(
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

export async function advanceGamePresentationCommand(
  value: string,
  expectedRevision: GameRevision,
  nowMs = Date.now(),
) {
  const roomId = normalizeRoomId(value);

  return gameConditionalCommand(
    roomId,
    expectedRevision,
    async (client) => {
      const room = await loadRoom(client, roomId);

      const changed =
        room.status === "order_roll"
          ? await advanceOrderRollPresentation(client, room, nowMs)
          : room.status === "playing"
            ? await advanceBattlePresentation(client, room, nowMs)
            : false;

      return { value: null, changed };
    },
  );
}
