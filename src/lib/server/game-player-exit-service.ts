import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { isBattle } from "@/src/lib/game-battle-service";
import { playerGameCommand } from "@/src/lib/game-command";
import { resolveCommandPlayerBySession } from "@/src/lib/game-command-player";
import type { GameCommandRequestMetadata } from "@/src/lib/game-command-request";
import {
  balancedTerritoryAssignments,
  DEPARTURE_REDISTRIBUTED_TROOPS,
  type DepartureRecipient,
} from "@/src/lib/shared/game-departure-rules";
import { advanceGameRound } from "@/src/lib/server/game-round-service";
import { beginPlayerTurnPhase } from "@/src/lib/server/game-turn-service";
import {
  evaluateGameVictories,
  finalizeGameVictories,
  finalizeGameWithoutWinner,
} from "@/src/lib/server/game-victory-service";
import { RoomError } from "@/src/lib/server/room-error";

type DepartureRoom = {
  id: string;
  code: string;
  status: "waiting" | "order_roll" | "playing" | "finished";
  current_player_id: string | null;
  round_number: number;
  jurassic_tunnel_territory_id: number | null;
  last_battle: unknown | null;
};

type DepartureRecipientRow = DepartureRecipient & {
  id: string;
  turn_position: number | null;
};

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

async function loadRoom(client: PoolClient, roomId: string) {
  const room = (
    await client.query<DepartureRoom>(
      `SELECT id,code,status,current_player_id,round_number,
              jurassic_tunnel_territory_id,last_battle
       FROM game.rooms
       WHERE id=$1`,
      [roomId],
    )
  ).rows[0];

  if (!room || room.status === "waiting") {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return room;
}

async function loadRecipients(
  client: PoolClient,
  room: DepartureRoom,
  departingPlayerId: string,
) {
  const requireTurnPosition = room.status === "playing";
  const rows = (
    await client.query<{
      id: string;
      turn_position: number | null;
      territory_count: number;
    }>(
      `SELECT p.id::text,
              p.turn_position,
              COUNT(t.territory_id)::int AS territory_count
       FROM game.players p
       LEFT JOIN game.territories t
         ON t.room_id=p.room_id
        AND t.owner_player_id=p.id
       WHERE p.room_id=$1
         AND p.id<>$2
         AND p.left_at IS NULL
         AND ($3::boolean=FALSE OR p.turn_position IS NOT NULL)
       GROUP BY p.id,p.turn_position,p.joined_at
       ORDER BY p.turn_position NULLS LAST,p.joined_at,p.id`,
      [room.id, departingPlayerId, requireTurnPosition],
    )
  ).rows;

  return rows.map((row) => ({
    id: row.id,
    playerId: row.id,
    turn_position: row.turn_position,
    territoryCount: row.territory_count,
  }));
}

async function departingTerritoryIds(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  return (
    await client.query<{ territory_id: number }>(
      `SELECT territory_id
       FROM game.territories
       WHERE room_id=$1 AND owner_player_id=$2
       ORDER BY territory_id
       FOR UPDATE`,
      [roomId, playerId],
    )
  ).rows.map((row) => row.territory_id);
}

function shuffled(values: readonly number[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

async function redistributeTerritories(
  client: PoolClient,
  roomId: string,
  territoryIds: readonly number[],
  recipients: readonly DepartureRecipientRow[],
) {
  if (territoryIds.length === 0 || recipients.length === 0) return [];

  const assignments = balancedTerritoryAssignments(
    shuffled(territoryIds),
    recipients,
    (exclusiveMax) => randomInt(exclusiveMax),
  );
  const ids = assignments.map((assignment) => assignment.territoryId);
  const owners = assignments.map((assignment) => assignment.playerId);

  await client.query(
    `UPDATE game.territories territory
        SET owner_player_id=assignment.player_id,
            troops=$4::smallint,
            moved_in_turn=0
       FROM unnest($2::smallint[], $3::bigint[])
            AS assignment(territory_id,player_id)
      WHERE territory.room_id=$1
        AND territory.territory_id=assignment.territory_id`,
    [roomId, ids, owners, DEPARTURE_REDISTRIBUTED_TROOPS],
  );

  return assignments;
}

async function normalizeActiveTurnPositions(
  client: PoolClient,
  roomId: string,
) {
  await client.query(
    `WITH ranked AS (
       SELECT id,
              ROW_NUMBER() OVER (ORDER BY turn_position,id)::smallint AS position
       FROM game.players
       WHERE room_id=$1
         AND left_at IS NULL
         AND turn_position IS NOT NULL
     )
     UPDATE game.players player
        SET turn_position=ranked.position+10
       FROM ranked
      WHERE player.id=ranked.id`,
    [roomId],
  );
  await client.query(
    `UPDATE game.players
        SET turn_position=turn_position-10
      WHERE room_id=$1
        AND left_at IS NULL
        AND turn_position>10`,
    [roomId],
  );
}

async function cancelDepartureTradeState(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  await client.query(
    `UPDATE game.trade_offers
        SET status='cancelled',resolved_at=NOW()
      WHERE room_id=$1
        AND status IN ('open','countered','accepted_pending_selection')
        AND (
          proposer_player_id=$2
          OR target_player_id=$2
          OR responder_player_id=$2
        )`,
    [roomId, playerId],
  );
  await client.query(
    `UPDATE game.cards
        SET zone='discard',owner_player_id=NULL,deck_order=NULL
      WHERE room_id=$1
        AND owner_player_id=$2
        AND zone='hand'`,
    [roomId, playerId],
  );
}

async function markDeparted(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  const result = await client.query(
    `UPDATE game.players
        SET left_at=NOW(),
            turn_position=NULL,
            bot_next_action_at=NULL,
            is_ready=FALSE,
            trade_signals_used=0
      WHERE room_id=$1
        AND id=$2
        AND is_bot=FALSE
        AND left_at IS NULL`,
    [roomId, playerId],
  );
  if ((result.rowCount ?? 0) !== 1) {
    throw new RoomError("Este jogador já saiu da partida.", 409);
  }
}

async function clearInvalidInteractionState(
  client: PoolClient,
  room: DepartureRoom,
  playerId: string,
) {
  const battle = isBattle(room.last_battle) ? room.last_battle : null;
  const battleInvolvesPlayer =
    battle?.attackerPlayerId === playerId ||
    battle?.defenderPlayerId === playerId;

  if (room.current_player_id === playerId) {
    await client.query(
      `UPDATE game.rooms
          SET last_battle=NULL,
              pending_from_territory_id=NULL,
              pending_to_territory_id=NULL,
              reinforcements_remaining=0,
              conquered_this_turn=FALSE
        WHERE id=$1`,
      [room.id],
    );
    return;
  }

  if (battleInvolvesPlayer) {
    await client.query(
      "UPDATE game.rooms SET last_battle=NULL WHERE id=$1",
      [room.id],
    );
  }
}

function nextRecipient(
  recipients: readonly DepartureRecipientRow[],
  departingTurnPosition: number | null,
) {
  const ordered = recipients
    .filter(
      (recipient): recipient is DepartureRecipientRow & { turn_position: number } =>
        recipient.turn_position !== null,
    )
    .sort(
      (left, right) =>
        left.turn_position - right.turn_position ||
        Number(left.id) - Number(right.id),
    );

  if (ordered.length === 0) return null;
  if (departingTurnPosition === null) {
    return { player: ordered[0], wrapsRound: false };
  }

  const after = ordered.find(
    (recipient) => recipient.turn_position > departingTurnPosition,
  );
  const player = after ?? ordered[0];
  return {
    player,
    wrapsRound: player.turn_position <= departingTurnPosition,
  };
}

async function finishFromRedistribution(
  client: PoolClient,
  roomId: string,
  recipients: readonly DepartureRecipientRow[],
) {
  if (recipients.length === 0) {
    await finalizeGameWithoutWinner(client, roomId);
    return true;
  }

  const candidateIds = recipients.map((recipient) => recipient.id);
  const objectiveWinners = await evaluateGameVictories(
    client,
    roomId,
    candidateIds,
    "territory_control_changed",
  );

  if (objectiveWinners.length > 0) {
    await finalizeGameVictories(client, roomId, objectiveWinners);
    return true;
  }

  if (recipients.length === 1) {
    await finalizeGameVictories(client, roomId, [recipients[0].id]);
    return true;
  }

  return false;
}

async function advanceAfterCurrentPlayerDeparture(
  client: PoolClient,
  room: DepartureRoom,
  departingTurnPosition: number | null,
  recipients: readonly DepartureRecipientRow[],
) {
  const next = nextRecipient(recipients, departingTurnPosition);
  if (!next) {
    await finalizeGameWithoutWinner(client, room.id);
    return;
  }

  if (next.wrapsRound) {
    const activation = await advanceGameRound(client, {
      roomId: room.id,
      currentRoundNumber: room.round_number,
      previousJurassicTunnelDestinationId:
        room.jurassic_tunnel_territory_id,
    });

    if (activation.appliedTroopChanges.some((change) => change.delta > 0)) {
      const eventWinners = await evaluateGameVictories(
        client,
        room.id,
        recipients.map((recipient) => recipient.id),
        "troops_changed",
      );
      if (eventWinners.length > 0) {
        await finalizeGameVictories(client, room.id, eventWinners);
        return;
      }
    }
  }

  await normalizeActiveTurnPositions(client, room.id);
  await client.query(
    `UPDATE game.rooms
        SET current_player_id=$2,
            turn_number=turn_number+1,
            reinforcements_remaining=0,
            conquered_this_turn=FALSE
      WHERE id=$1`,
    [room.id, next.player.id],
  );
  await beginPlayerTurnPhase(client, room.id, next.player.id);
}

export async function executeLeaveGame(
  client: PoolClient,
  roomId: string,
  playerId: string,
  departingTurnPosition: number | null,
) {
  const room = await loadRoom(client, roomId);

  if (room.status === "finished") {
    await markDeparted(client, room.id, playerId);
    await client.query(
      "DELETE FROM game.rematch_votes WHERE room_id=$1 AND player_id=$2",
      [room.id, playerId],
    );
    return { left: true, code: room.code, finished: true };
  }

  const recipients = await loadRecipients(client, room, playerId);
  const territoryIds = await departingTerritoryIds(client, room.id, playerId);

  await cancelDepartureTradeState(client, room.id, playerId);
  await clearInvalidInteractionState(client, room, playerId);
  await markDeparted(client, room.id, playerId);
  await redistributeTerritories(
    client,
    room.id,
    territoryIds,
    recipients,
  );

  const finished = await finishFromRedistribution(
    client,
    room.id,
    recipients,
  );
  if (finished) {
    return { left: true, code: room.code, finished: true };
  }

  if (room.status === "playing") {
    if (room.current_player_id === playerId) {
      await advanceAfterCurrentPlayerDeparture(
        client,
        room,
        departingTurnPosition,
        recipients,
      );
    } else {
      await normalizeActiveTurnPositions(client, room.id);
    }
  }

  return { left: true, code: room.code, finished: false };
}

export async function leaveGameCommand(
  value: string,
  session: string,
  metadata?: GameCommandRequestMetadata | null,
  accountUserId?: string,
) {
  const roomId = normalizeRoomId(value);

  return playerGameCommand(
    roomId,
    session,
    metadata,
    "leave_game",
    null,
    async (client) => {
      const player = await resolveCommandPlayerBySession(
        client,
        roomId,
        session,
        accountUserId,
        true,
      );
      return executeLeaveGame(
        client,
        roomId,
        player.id,
        player.turn_position,
      );
    },
    {
      accountUserId,
      allowDepartedSeat: true,
    },
  );
}
