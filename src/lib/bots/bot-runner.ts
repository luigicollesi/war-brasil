import "server-only";

import type { PoolClient } from "pg";
import { isBattle } from "@/src/lib/game-battle-service";
import {
  executePhaseAction,
  executeRollOrderDie,
} from "@/src/lib/game-command-service";
import type { CommandPlayer } from "@/src/lib/game-command-player";
import { executeRollBattleDice } from "@/src/lib/game-combat-command-service";
import { executeCompleteConquest } from "@/src/lib/game-conquest-command-service";
import {
  nextOrderRollPlayerId,
  type OrderPlayer,
  type OrderRoll,
} from "@/src/lib/game-order-rules";
import { executeReinforcement } from "@/src/lib/game-troop-command-service";
import type { BotAction } from "./bot-action";
import { pickBotDelayMs } from "./bot-delay";
import { requiredActorId } from "./bot-required-actor";

type AutomationRoom = {
  id: string;
  status: "waiting" | "order_roll" | "playing" | "finished";
  order_roll_round: number;
  phase: string;
  current_player_id: string | null;
  reinforcements_remaining: number;
  pending_from_territory_id: number | null;
  pending_to_territory_id: number | null;
  last_battle: unknown | null;
};

type AutomationPlayer = CommandPlayer & {
  is_bot: boolean;
  bot_next_action_at: Date | null;
};

export type BotAutomationResult = {
  changed: boolean;
  kind: "none" | "scheduled" | "acted";
};

async function loadRoom(client: PoolClient, roomId: string) {
  return (
    await client.query<AutomationRoom>(
      `SELECT id,status,order_roll_round,phase,current_player_id,
              reinforcements_remaining,pending_from_territory_id,
              pending_to_territory_id,last_battle
       FROM game_rooms
       WHERE id=$1`,
      [roomId],
    )
  ).rows[0] ?? null;
}

async function loadPlayers(client: PoolClient, roomId: string) {
  return (
    await client.query<AutomationPlayer>(
      `SELECT id,turn_position,is_bot,bot_next_action_at
       FROM room_players
       WHERE room_id=$1
       ORDER BY joined_at,id`,
      [roomId],
    )
  ).rows;
}

async function orderRollPlayerId(
  client: PoolClient,
  room: AutomationRoom,
  players: AutomationPlayer[],
) {
  if (room.status !== "order_roll") return null;

  const rolls = (
    await client.query<OrderRoll>(
      `SELECT player_id,roll_round,value
       FROM game_order_rolls
       WHERE room_id=$1
       ORDER BY roll_round,rolled_at`,
      [room.id],
    )
  ).rows;

  return nextOrderRollPlayerId(
    players as OrderPlayer[],
    rolls,
    room.order_roll_round,
  );
}

async function chooseBasicBotAction(
  client: PoolClient,
  room: AutomationRoom,
  player: AutomationPlayer,
): Promise<BotAction | null> {
  if (room.status === "order_roll") return { type: "roll_order" };
  if (room.status !== "playing") return null;

  const battle = isBattle(room.last_battle) ? room.last_battle : null;
  if (
    battle?.stage === "awaiting_attacker_roll" ||
    battle?.stage === "awaiting_defender_roll"
  ) {
    return { type: "roll_battle" };
  }

  if (
    room.pending_from_territory_id !== null &&
    room.pending_to_territory_id !== null
  ) {
    return { type: "complete_conquest", troops: 1 };
  }

  if (room.phase === "cards") return { type: "finish_cards" };

  if (room.phase === "reinforcement") {
    if (room.reinforcements_remaining < 1) return null;
    const territory = (
      await client.query<{ territory_id: number }>(
        `SELECT territory_id
         FROM game_territories
         WHERE room_id=$1 AND owner_player_id=$2
         ORDER BY territory_id
         LIMIT 1`,
        [room.id, player.id],
      )
    ).rows[0];

    return territory
      ? {
          type: "reinforce",
          territoryId: territory.territory_id,
          troops: room.reinforcements_remaining,
        }
      : null;
  }

  if (room.phase === "attack") return { type: "finish_attack" };
  if (room.phase === "maneuver") return { type: "end_turn" };
  return null;
}

async function executeBotAction(
  client: PoolClient,
  roomId: string,
  player: AutomationPlayer,
  action: BotAction,
) {
  switch (action.type) {
    case "roll_order":
      await executeRollOrderDie(client, roomId, player);
      return;
    case "finish_cards":
      await executePhaseAction(client, roomId, player, {
        action: "finishCards",
      });
      return;
    case "reinforce":
      await executeReinforcement(client, roomId, player, action);
      return;
    case "finish_attack":
      await executePhaseAction(client, roomId, player, {
        action: "finishAttack",
      });
      return;
    case "roll_battle":
      await executeRollBattleDice(client, roomId, player);
      return;
    case "complete_conquest":
      await executeCompleteConquest(client, roomId, player, action.troops);
      return;
    case "end_turn":
      await executePhaseAction(client, roomId, player, { action: "endTurn" });
      return;
  }
}

export async function advanceBotAutomation(
  client: PoolClient,
  roomId: string,
  nowMs = Date.now(),
): Promise<BotAutomationResult> {
  const room = await loadRoom(client, roomId);
  if (!room || room.status === "waiting" || room.status === "finished") {
    return { changed: false, kind: "none" };
  }

  const players = await loadPlayers(client, roomId);
  const battle = isBattle(room.last_battle) ? room.last_battle : null;
  const nextOrderPlayerId = await orderRollPlayerId(client, room, players);
  const actorId = requiredActorId({
    status: room.status,
    orderRollPlayerId: nextOrderPlayerId,
    currentPlayerId: room.current_player_id,
    battle,
    pendingConquest:
      room.pending_from_territory_id !== null &&
      room.pending_to_territory_id !== null,
  });

  if (!actorId) return { changed: false, kind: "none" };

  const actor = players.find((player) => player.id === actorId);
  if (!actor?.is_bot) return { changed: false, kind: "none" };

  const action = await chooseBasicBotAction(client, room, actor);
  if (!action) return { changed: false, kind: "none" };

  if (actor.bot_next_action_at === null) {
    const dueAt = new Date(nowMs + pickBotDelayMs(action.type));
    await client.query(
      `UPDATE room_players
       SET bot_next_action_at=$3
       WHERE room_id=$1 AND id=$2 AND is_bot=TRUE`,
      [roomId, actor.id, dueAt],
    );
    return { changed: true, kind: "scheduled" };
  }

  if (actor.bot_next_action_at.getTime() > nowMs) {
    return { changed: false, kind: "none" };
  }

  await executeBotAction(client, roomId, actor, action);
  await client.query(
    `UPDATE room_players
     SET bot_next_action_at=NULL
     WHERE room_id=$1 AND id=$2 AND is_bot=TRUE`,
    [roomId, actor.id],
  );

  return { changed: true, kind: "acted" };
}
