import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { gameCommand } from "@/src/lib/game-command";
import {
  resolveCommandPlayerBySession,
  type CommandPlayer,
} from "@/src/lib/game-command-player";
import { objectiveWon } from "@/src/lib/game-objective-service";
import {
  nextOrderRollPlayerId,
  type OrderPlayer,
  type OrderRoll,
} from "@/src/lib/game-order-rules";
import { advanceGameRound } from "@/src/lib/game-round-service";
import { reinforcementFor } from "@/src/lib/game-rules";
import { RoomError } from "@/src/lib/rooms";

type CommandRoom = {
  id: string;
  status: "order_roll" | "playing" | "finished";
  order_roll_round: number;
  initial_territory_presentation_started_at: Date | null;
  phase: string;
  current_player_id: string | null;
  round_number: number;
  jurassic_tunnel_territory_id: number | null;
  conquered_this_turn: boolean;
  pending_from_territory_id: number | null;
  last_battle: unknown | null;
};

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

async function loadRoom(client: PoolClient, roomId: string) {
  const result = await client.query<CommandRoom>(
    `SELECT id,status,order_roll_round,initial_territory_presentation_started_at,
            phase,current_player_id,round_number,
            jurassic_tunnel_territory_id,conquered_this_turn,
            pending_from_territory_id,last_battle
     FROM game_rooms
     WHERE id=$1`,
    [roomId],
  );

  const room = result.rows[0];
  if (!room) throw new RoomError("Partida não encontrada.", 404);
  return room;
}

function assertTurn(
  room: CommandRoom,
  player: CommandPlayer,
  phase: string,
) {
  if (
    room.status !== "playing" ||
    room.phase !== phase ||
    room.current_player_id !== player.id
  ) {
    throw new RoomError("Esta ação não está disponível neste momento.", 409, {
      roomStatus: room.status,
      roomPhase: room.phase,
      expectedPhase: phase,
      currentPlayerId: room.current_player_id,
      requestPlayerId: player.id,
    });
  }
}

async function beginReinforcement(
  client: PoolClient,
  room: CommandRoom,
  player: CommandPlayer,
) {
  const owned = (
    await client.query<{ territory_id: number }>(
      `SELECT territory_id
       FROM game_territories
       WHERE room_id=$1 AND owner_player_id=$2`,
      [room.id, player.id],
    )
  ).rows;

  const reinforcements = reinforcementFor(
    owned.map((territory) => territory.territory_id),
  );

  await client.query(
    `UPDATE game_rooms
     SET phase='reinforcement',reinforcements_remaining=$2
     WHERE id=$1`,
    [room.id, reinforcements],
  );
}

async function drawCard(
  client: PoolClient,
  room: CommandRoom,
  playerId: string,
) {
  let card = await client.query<{ id: string }>(
    `SELECT id
     FROM game_cards
     WHERE room_id=$1 AND zone='deck'
     ORDER BY deck_order
     FOR UPDATE
     LIMIT 1`,
    [room.id],
  );

  if (!card.rowCount) {
    const discard = (
      await client.query<{ id: string }>(
        `SELECT id
         FROM game_cards
         WHERE room_id=$1 AND zone='discard'
         FOR UPDATE`,
        [room.id],
      )
    ).rows;

    const order = discard.map((_, index) => index + 1);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(0, index + 1);
      [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
    }

    for (const [index, item] of discard.entries()) {
      await client.query(
        `UPDATE game_cards
         SET zone='deck',deck_order=$2
         WHERE id=$1`,
        [item.id, order[index]],
      );
    }

    card = await client.query<{ id: string }>(
      `SELECT id
       FROM game_cards
       WHERE room_id=$1 AND zone='deck'
       ORDER BY deck_order
       FOR UPDATE
       LIMIT 1`,
      [room.id],
    );
  }

  if (card.rowCount) {
    await client.query(
      `UPDATE game_cards
       SET zone='hand',owner_player_id=$2,deck_order=NULL
       WHERE id=$1`,
      [card.rows[0].id, playerId],
    );
  }
}

async function evaluateRoundTroopObjectiveWinners(
  client: PoolClient,
  roomId: string,
) {
  const players = (
    await client.query<{ id: string }>(
      `SELECT id
       FROM room_players
       WHERE room_id=$1 AND turn_position IS NOT NULL
       ORDER BY turn_position,id`,
      [roomId],
    )
  ).rows;

  for (const candidate of players) {
    if (await objectiveWon(client, roomId, candidate.id, "troops_changed")) {
      return true;
    }
  }

  return false;
}

export async function executeRollOrderDie(
  client: PoolClient,
  roomId: string,
  player: CommandPlayer,
) {
  const room = await loadRoom(client, roomId);
  if (room.status !== "order_roll") {
    throw new RoomError("O sorteio de ordem não está disponível.", 409);
  }
  if (room.initial_territory_presentation_started_at) {
    throw new RoomError(
      "A apresentação inicial dos territórios ainda está em andamento.",
      409,
    );
  }

  const players = (
    await client.query<OrderPlayer>(
      "SELECT id FROM room_players WHERE room_id=$1 ORDER BY joined_at,id",
      [room.id],
    )
  ).rows;
  const rolls = (
    await client.query<OrderRoll>(
      `SELECT player_id,roll_round,value
       FROM game_order_rolls
       WHERE room_id=$1
       ORDER BY roll_round,rolled_at`,
      [room.id],
    )
  ).rows;

  const nextPlayerId = nextOrderRollPlayerId(
    players,
    rolls,
    room.order_roll_round,
  );

  if (player.id !== nextPlayerId) {
    throw new RoomError("Aguarde sua vez de rolar o dado.", 409, {
      nextPlayerId,
      requestPlayerId: player.id,
    });
  }

  const die = randomInt(1, 7);
  await client.query(
    `INSERT INTO game_order_rolls(room_id,player_id,roll_round,value)
     VALUES($1,$2,$3,$4)`,
    [room.id, player.id, room.order_roll_round, die],
  );

  return { value: die };
}

export async function executePhaseAction(
  client: PoolClient,
  roomId: string,
  player: CommandPlayer,
  input: Record<string, unknown>,
) {
  const room = await loadRoom(client, roomId);

  if (input.action === "finishCards") {
    assertTurn(room, player, "cards");
    await beginReinforcement(client, room, player);
    return null;
  }

  if (input.action === "finishAttack") {
    assertTurn(room, player, "attack");
    if (room.last_battle !== null || room.pending_from_territory_id) {
      throw new RoomError(
        "Conclua a batalha atual antes de encerrar os ataques.",
        409,
      );
    }

    await client.query(
      `UPDATE game_territories
       SET moved_in_turn=0
       WHERE room_id=$1 AND owner_player_id=$2`,
      [room.id, player.id],
    );
    await client.query(
      "UPDATE game_rooms SET phase='maneuver' WHERE id=$1",
      [room.id],
    );
    return null;
  }

  if (input.action !== "endTurn") {
    throw new RoomError("Ação de fase inválida.", 422);
  }

  assertTurn(room, player, "maneuver");

  if (room.conquered_this_turn) {
    await drawCard(client, room, player.id);
  }

  const next =
    (
      await client.query<{ id: string; turn_position: number | null }>(
        `SELECT p.id,p.turn_position
         FROM room_players p
         WHERE p.room_id=$1
           AND p.turn_position>(SELECT turn_position FROM room_players WHERE id=$2)
           AND EXISTS(
             SELECT 1
             FROM game_territories
             WHERE room_id=$1 AND owner_player_id=p.id
           )
         ORDER BY p.turn_position
         LIMIT 1`,
        [room.id, player.id],
      )
    ).rows[0] ??
    (
      await client.query<{ id: string; turn_position: number | null }>(
        `SELECT p.id,p.turn_position
         FROM room_players p
         WHERE p.room_id=$1
           AND EXISTS(
             SELECT 1
             FROM game_territories
             WHERE room_id=$1 AND owner_player_id=p.id
           )
         ORDER BY p.turn_position
         LIMIT 1`,
        [room.id],
      )
    ).rows[0];

  if (!next) {
    throw new RoomError("Não há próximo jogador ativo.", 409);
  }

  await client.query(
    "UPDATE game_territories SET moved_in_turn=0 WHERE room_id=$1",
    [room.id],
  );

  const wrapsRound = (next.turn_position ?? 0) <= (player.turn_position ?? 0);
  if (wrapsRound) {
    const roundActivation = await advanceGameRound(client, {
      roomId: room.id,
      currentRoundNumber: room.round_number,
      previousJurassicTunnelDestinationId:
        room.jurassic_tunnel_territory_id,
    });

    if (
      roundActivation.appliedTroopChanges.some((change) => change.delta > 0) &&
      (await evaluateRoundTroopObjectiveWinners(client, room.id))
    ) {
      return null;
    }
  }

  await client.query(
    `UPDATE game_rooms
     SET phase='cards',current_player_id=$2,turn_number=turn_number+1,
         reinforcements_remaining=0,conquered_this_turn=FALSE
     WHERE id=$1`,
    [room.id, next.id],
  );

  return null;
}

export async function rollOrderDieCommand(value: string, session: string) {
  const roomId = normalizeRoomId(value);

  return gameCommand(roomId, async (client) => {
    const player = await resolveCommandPlayerBySession(client, roomId, session);
    return executeRollOrderDie(client, roomId, player);
  });
}

export async function phaseCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
) {
  const roomId = normalizeRoomId(value);

  return gameCommand(roomId, async (client) => {
    const player = await resolveCommandPlayerBySession(client, roomId, session);
    return executePhaseAction(client, roomId, player, input);
  });
}
