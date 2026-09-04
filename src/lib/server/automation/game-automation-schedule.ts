import "server-only";

import type { PoolClient } from "pg";
import { pickBotDelayMs } from "@/src/lib/bots/bot-delay";
import { requiredActorId } from "@/src/lib/bots/bot-required-actor";
import { scheduledBotActionType } from "@/src/lib/bots/bot-schedule";
import { isBattle } from "@/src/lib/game-battle-service";
import {
  eligibleOrderPlayerIds,
  nextOrderRollPlayerId,
  type OrderPlayer,
  type OrderRoll,
} from "@/src/lib/game-order-rules";
import {
  battlePresentationDueAt,
  initialTerritoryPresentationDueAt,
  orderRollActorAvailableAt,
  orderRollPresentationDueAt,
} from "@/src/lib/game-transitions";

export type GameAutomationKind = "presentation" | "bot";

export type GameAutomationSchedule = {
  kind: GameAutomationKind | null;
  dueAt: Date | null;
};

type ScheduleRoom = {
  id: string;
  status: "waiting" | "order_roll" | "playing" | "finished";
  order_roll_round: number;
  initial_territory_presentation_started_at: Date | null;
  phase: string;
  current_player_id: string | null;
  pending_from_territory_id: number | null;
  pending_to_territory_id: number | null;
  last_battle: unknown | null;
};

type SchedulePlayer = OrderPlayer & {
  is_bot: boolean;
  bot_next_action_at: Date | null;
};

type ScheduleOrderRoll = OrderRoll & {
  rolled_at: Date;
};

async function loadRoom(client: PoolClient, roomId: string) {
  return (
    await client.query<ScheduleRoom>(
      `SELECT id,status,order_roll_round,initial_territory_presentation_started_at,
              phase,current_player_id,pending_from_territory_id,
              pending_to_territory_id,last_battle
       FROM game_rooms
       WHERE id=$1`,
      [roomId],
    )
  ).rows[0] ?? null;
}

async function loadPlayers(client: PoolClient, roomId: string) {
  return (
    await client.query<SchedulePlayer>(
      `SELECT id,is_bot,bot_next_action_at
       FROM room_players
       WHERE room_id=$1
       ORDER BY joined_at,id`,
      [roomId],
    )
  ).rows;
}

async function loadOrderRolls(client: PoolClient, room: ScheduleRoom) {
  if (room.status !== "order_roll") return [] as ScheduleOrderRoll[];
  return (
    await client.query<ScheduleOrderRoll>(
      `SELECT player_id,roll_round,value,rolled_at
       FROM game_order_rolls
       WHERE room_id=$1
       ORDER BY roll_round,rolled_at`,
      [room.id],
    )
  ).rows;
}

function latestRollAt(rolls: ScheduleOrderRoll[]) {
  return rolls.reduce<Date | null>(
    (latest, roll) =>
      !latest || roll.rolled_at.getTime() > latest.getTime()
        ? roll.rolled_at
        : latest,
    null,
  );
}

function currentRoundRolls(room: ScheduleRoom, rolls: ScheduleOrderRoll[]) {
  return rolls.filter((roll) => roll.roll_round === room.order_roll_round);
}

function botActionBaseTimeMs(
  room: ScheduleRoom,
  rolls: ScheduleOrderRoll[],
  actionType: ReturnType<typeof scheduledBotActionType>,
  nowMs: number,
) {
  if (actionType !== "roll_order") return nowMs;

  const availableAt = orderRollActorAvailableAt(
    latestRollAt(currentRoundRolls(room, rolls)),
  );
  return Math.max(nowMs, availableAt?.getTime() ?? nowMs);
}

async function clearOtherBotSchedules(
  client: PoolClient,
  roomId: string,
  keepPlayerId: string | null,
) {
  await client.query(
    `UPDATE room_players
     SET bot_next_action_at=NULL
     WHERE room_id=$1
       AND is_bot=TRUE
       AND ($2::bigint IS NULL OR id<>$2::bigint)
       AND bot_next_action_at IS NOT NULL`,
    [roomId, keepPlayerId],
  );
}

async function persistRoomSchedule(
  client: PoolClient,
  roomId: string,
  schedule: GameAutomationSchedule,
) {
  await client.query(
    `UPDATE game_rooms
     SET automation_due_at=$2,
         automation_kind=$3,
         automation_claimed_by=NULL,
         automation_claimed_until=NULL
     WHERE id=$1
       AND (
         automation_due_at IS DISTINCT FROM $2::timestamptz
         OR automation_kind IS DISTINCT FROM $3::varchar
       )`,
    [roomId, schedule.dueAt, schedule.kind],
  );
  return schedule;
}

async function presentationSchedule(
  client: PoolClient,
  room: ScheduleRoom,
  players: SchedulePlayer[],
  rolls: ScheduleOrderRoll[],
): Promise<{ schedule: GameAutomationSchedule | null; orderRollPlayerId: string | null }> {
  if (room.status === "order_roll" && room.initial_territory_presentation_started_at) {
    return {
      schedule: {
        kind: "presentation",
        dueAt: initialTerritoryPresentationDueAt(
          room.initial_territory_presentation_started_at,
        ),
      },
      orderRollPlayerId: null,
    };
  }

  if (room.status === "order_roll") {
    const eligible = eligibleOrderPlayerIds(players, rolls, room.order_roll_round);
    const currentRolls = rolls.filter(
      (roll) =>
        roll.roll_round === room.order_roll_round &&
        eligible.includes(roll.player_id),
    );
    const allRolled =
      eligible.length > 0 &&
      eligible.every((playerId) =>
        currentRolls.some((roll) => roll.player_id === playerId),
      );
    const dueAt = orderRollPresentationDueAt(
      allRolled,
      latestRollAt(currentRolls),
    );

    if (dueAt) {
      return {
        schedule: { kind: "presentation", dueAt },
        orderRollPlayerId: null,
      };
    }

    return {
      schedule: null,
      orderRollPlayerId: nextOrderRollPlayerId(
        players,
        rolls,
        room.order_roll_round,
      ),
    };
  }

  const battle = isBattle(room.last_battle) ? room.last_battle : null;
  if (room.status === "playing" && battle) {
    const dueAt = battlePresentationDueAt(
      battle.stage,
      battle.stageStartedAt,
    );
    if (dueAt) {
      return {
        schedule: { kind: "presentation", dueAt },
        orderRollPlayerId: null,
      };
    }
  }

  return { schedule: null, orderRollPlayerId: null };
}

export async function reconcileGameAutomationSchedule(
  client: PoolClient,
  roomId: string,
  nowMs = Date.now(),
): Promise<GameAutomationSchedule> {
  const room = await loadRoom(client, roomId);
  if (!room || room.status === "waiting" || room.status === "finished") {
    if (room) {
      await clearOtherBotSchedules(client, room.id, null);
      return persistRoomSchedule(client, room.id, { kind: null, dueAt: null });
    }
    return { kind: null, dueAt: null };
  }

  const players = await loadPlayers(client, room.id);
  const rolls = await loadOrderRolls(client, room);
  const presentation = await presentationSchedule(client, room, players, rolls);

  if (presentation.schedule?.dueAt) {
    await clearOtherBotSchedules(client, room.id, null);
    return persistRoomSchedule(client, room.id, presentation.schedule);
  }

  const battle = isBattle(room.last_battle) ? room.last_battle : null;
  const actorId = requiredActorId({
    status: room.status,
    orderRollPlayerId: presentation.orderRollPlayerId,
    currentPlayerId: room.current_player_id,
    battle,
    pendingConquest:
      room.pending_from_territory_id !== null &&
      room.pending_to_territory_id !== null,
  });
  const actor = actorId
    ? players.find((player) => player.id === actorId) ?? null
    : null;

  if (!actor?.is_bot) {
    await clearOtherBotSchedules(client, room.id, null);
    return persistRoomSchedule(client, room.id, { kind: null, dueAt: null });
  }

  const actionType = scheduledBotActionType({
    status: room.status,
    phase: room.phase,
    pendingFromTerritoryId: room.pending_from_territory_id,
    pendingToTerritoryId: room.pending_to_territory_id,
    battleStage: battle?.stage ?? null,
  });

  if (!actionType) {
    await clearOtherBotSchedules(client, room.id, null);
    return persistRoomSchedule(client, room.id, { kind: null, dueAt: null });
  }

  const actionBaseTimeMs = botActionBaseTimeMs(room, rolls, actionType, nowMs);
  let dueAt = actor.bot_next_action_at;
  if (!dueAt || dueAt.getTime() < actionBaseTimeMs) {
    dueAt = new Date(actionBaseTimeMs + pickBotDelayMs(actionType));
    await client.query(
      `UPDATE room_players
       SET bot_next_action_at=$3
       WHERE room_id=$1 AND id=$2 AND is_bot=TRUE`,
      [room.id, actor.id, dueAt],
    );
  }

  await clearOtherBotSchedules(client, room.id, actor.id);
  return persistRoomSchedule(client, room.id, { kind: "bot", dueAt });
}
