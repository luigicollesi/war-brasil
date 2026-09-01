import "server-only";

import type { PoolClient } from "pg";
import type { PlayerColor } from "@/src/lib/lobby";
import {
  isPresentationAdvancePending,
  requiredActorId,
} from "@/src/lib/bots/bot-required-actor";
import type { GameSnapshot } from "@/src/lib/game-contract";
import { isBattle } from "@/src/lib/game-battle-service";
import {
  eligibleOrderPlayerIds,
  nextOrderRollPlayerId,
  type OrderRoll,
} from "@/src/lib/game-order-rules";
import { getRoomRoundEventDetails } from "@/src/lib/events/event-repository";
import { EventConfigurationError } from "@/src/lib/events/event-types";
import { gameQuery } from "@/src/lib/game-query";
import { getBaseTerritoryConnections } from "@/src/lib/game-topology-service";
import { objectiveDescription } from "@/src/lib/objectives/objective-presentation";
import { withObjectiveSchemaCompatibility } from "@/src/lib/objectives/objective-schema-compatibility";
import { RoomError } from "@/src/lib/rooms";

type SnapshotRoom = {
  id: string;
  code: string;
  status: "waiting" | "order_roll" | "playing" | "finished";
  revision: number;
  order_roll_round: number;
  phase: GameSnapshot["room"]["phase"];
  current_player_id: string | null;
  turn_number: number;
  round_number: number;
  jurassic_tunnel_territory_id: number | null;
  reinforcements_remaining: number;
  winner_player_id: string | null;
  pending_from_territory_id: number | null;
  pending_to_territory_id: number | null;
  last_battle: unknown | null;
};

type SnapshotPlayer = {
  id: string;
  faction_name: string;
  color: PlayerColor;
  turn_position: number | null;
  is_me: boolean;
  is_bot: boolean;
};

type SnapshotTerritory = {
  territory_id: number;
  owner_player_id: string;
  color: PlayerColor;
  troops: number;
  moved_in_turn: number;
};

type SnapshotCard = {
  id: string;
  territory_id: number | null;
  symbol: "leaf" | "gold" | "water" | null;
  is_wild: boolean;
};

type SnapshotObjective = {
  id: string;
  type: string;
  name: string;
  description: string;
  params: Record<string, unknown>;
  target_name: string | null;
};

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

async function loadSnapshotObjective(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  return withObjectiveSchemaCompatibility(
    client,
    async () =>
      (
        await client.query<SnapshotObjective>(
          `SELECT o.id,o.type,o.name,o.description,
                  COALESCE(
                    CASE WHEN r.objective_id=a.objective_id THEN a.resolved_params END,
                    o.params
                  ) params,
                  t.faction_name target_name
           FROM game_player_objectives a
           JOIN objectives o ON o.id=a.objective_id
           LEFT JOIN objective_rules r ON r.id=a.objective_rule_id
           LEFT JOIN room_players t ON t.id=a.target_player_id
           WHERE a.room_id=$1 AND a.player_id=$2`,
          [roomId, playerId],
        )
      ).rows[0] ?? null,
    async () =>
      (
        await client.query<SnapshotObjective>(
          `SELECT o.id,o.type,o.name,o.description,o.params,
                  t.faction_name target_name
           FROM game_player_objectives a
           JOIN objectives o ON o.id=a.objective_id
           LEFT JOIN room_players t ON t.id=a.target_player_id
           WHERE a.room_id=$1 AND a.player_id=$2`,
          [roomId, playerId],
        )
      ).rows[0] ?? null,
  );
}

export async function getGameSnapshotQuery(
  value: string,
  session: string,
  knownRevision: number | null,
) {
  const roomId = normalizeRoomId(value);

  return gameQuery(async (client) => {
    const room = (
      await client.query<SnapshotRoom>(
        `SELECT gr.id,gr.code,gr.status,gr.revision,gr.order_roll_round,
                gr.phase,gr.current_player_id,gr.turn_number,gr.round_number,
                gr.jurassic_tunnel_territory_id,gr.reinforcements_remaining,
                gr.winner_player_id,gr.pending_from_territory_id,
                gr.pending_to_territory_id,gr.last_battle
         FROM game_rooms gr
         JOIN room_players access_player
           ON access_player.room_id=gr.id
          AND access_player.player_session=$2
         WHERE gr.id=$1`,
        [roomId, session],
      )
    ).rows[0];

    if (!room) {
      throw new RoomError("Partida não encontrada ou jogador sem acesso.", 404);
    }

    if (knownRevision !== null && room.revision === knownRevision) {
      return {
        revision: room.revision,
        snapshot: null as GameSnapshot | null,
      };
    }

    const players = (
      await client.query<SnapshotPlayer>(
        `SELECT id,faction_name,color,turn_position,is_bot,
                player_session=$2 is_me
         FROM room_players
         WHERE room_id=$1
         ORDER BY turn_position NULLS LAST,joined_at,id`,
        [room.id, session],
      )
    ).rows;
    const me = players.find((player) => player.is_me);
    if (!me) {
      throw new RoomError("Você não pertence a esta partida.", 403);
    }

    const territories = (
      await client.query<SnapshotTerritory>(
        `SELECT t.territory_id,t.owner_player_id,p.color,t.troops,t.moved_in_turn
         FROM game_territories t
         JOIN room_players p ON p.id=t.owner_player_id
         WHERE t.room_id=$1
         ORDER BY t.territory_id`,
        [room.id],
      )
    ).rows;

    const rolls =
      room.status === "order_roll"
        ? (
            await client.query<OrderRoll>(
              `SELECT player_id,roll_round,value
               FROM game_order_rolls
               WHERE room_id=$1
               ORDER BY roll_round,rolled_at`,
              [room.id],
            )
          ).rows
        : [];

    const cards = (
      await client.query<SnapshotCard>(
        `SELECT id,territory_id,symbol,is_wild
         FROM game_cards
         WHERE room_id=$1 AND owner_player_id=$2 AND zone='hand'
         ORDER BY id`,
        [room.id, me.id],
      )
    ).rows;

    const objective = await loadSnapshotObjective(client, room.id, me.id);

    const rematchVotes =
      room.status === "finished"
        ? (
            await client.query<{ player_id: string }>(
              `SELECT v.player_id
               FROM game_rematch_votes v
               JOIN room_players p ON p.id=v.player_id AND p.room_id=v.room_id
               WHERE v.room_id=$1 AND p.is_bot=FALSE`,
              [room.id],
            )
          ).rows
        : [];

    const byPlayer = new Map<
      string,
      Array<{ round: number; value: number }>
    >();
    for (const roll of rolls) {
      byPlayer.set(roll.player_id, [
        ...(byPlayer.get(roll.player_id) ?? []),
        { round: roll.roll_round, value: roll.value },
      ]);
    }

    const eligiblePlayerIds =
      room.status === "order_roll"
        ? eligibleOrderPlayerIds(players, rolls, room.order_roll_round)
        : [];
    const orderRollPlayerId =
      room.status === "order_roll"
        ? nextOrderRollPlayerId(players, rolls, room.order_roll_round)
        : null;
    const lastOrderRollPlayerId =
      rolls
        .filter((roll) => roll.roll_round === room.order_roll_round)
        .at(-1)?.player_id ?? null;
    const battle = isBattle(room.last_battle) ? room.last_battle : null;
    const presentationPending = isPresentationAdvancePending({
      status: room.status,
      orderRollPlayerId,
      eligiblePlayerCount: eligiblePlayerIds.length,
      battle,
    });
    const actorId = presentationPending
      ? null
      : requiredActorId({
          status: room.status,
          orderRollPlayerId,
          currentPlayerId: room.current_player_id,
          battle,
          pendingConquest:
            room.pending_from_territory_id !== null &&
            room.pending_to_territory_id !== null,
        });
    const automaticAdvancePending =
      presentationPending ||
      Boolean(
        actorId &&
          players.some((player) => player.id === actorId && player.is_bot),
      );

    const roundEvent =
      room.status === "playing" || room.status === "finished"
        ? await getRoomRoundEventDetails(client, room.id, room.round_number)
        : null;

    if (room.status === "playing" && !roundEvent) {
      throw new EventConfigurationError(
        `Partida ${room.id} está ativa sem evento registrado na rodada ${room.round_number}.`,
      );
    }

    const connections = [...(await getBaseTerritoryConnections(client))];
    const humanPlayerCount = players.filter((player) => !player.is_bot).length;

    const snapshot: GameSnapshot = {
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
        orderRollRound: room.order_roll_round,
        orderRollPlayerId,
        lastOrderRollPlayerId,
        phase: room.phase,
        currentPlayerId: room.current_player_id,
        turnNumber: room.turn_number,
        roundNumber: room.round_number,
        jurassicTunnelDestinationId: room.jurassic_tunnel_territory_id,
        activeEvent: roundEvent
          ? {
              eventId: roundEvent.eventId,
              name: roundEvent.name,
              description: roundEvent.description,
              resolvedEffects: roundEvent.resolvedEffects,
              appliedTroopChanges: roundEvent.appliedTroopChanges,
            }
          : null,
        reinforcementsRemaining: room.reinforcements_remaining,
        winnerPlayerId: room.winner_player_id,
        automaticAdvancePending,
        rematch:
          room.status === "finished"
            ? {
                voteCount: rematchVotes.length,
                requiredCount: humanPlayerCount,
                hasVoted: rematchVotes.some((vote) => vote.player_id === me.id),
              }
            : null,
        pendingConquest:
          room.pending_from_territory_id !== null &&
          room.pending_to_territory_id !== null
            ? {
                fromTerritoryId: room.pending_from_territory_id,
                toTerritoryId: room.pending_to_territory_id,
              }
            : null,
        battle,
      },
      players: players.map((player) => ({
        id: player.id,
        factionName: player.faction_name,
        color: player.color,
        turnPosition: player.turn_position,
        isMe: Boolean(player.is_me),
        isBot: player.is_bot,
        rolls: byPlayer.get(player.id) ?? [],
      })),
      territories: territories.map((territory) => ({
        territoryId: territory.territory_id,
        ownerPlayerId: territory.owner_player_id,
        ownerColor: territory.color,
        troops: territory.troops,
        movedInTurn: territory.moved_in_turn,
      })),
      eligiblePlayerIds,
      connections,
      myCards: cards.map((card) => ({
        id: card.id,
        territoryId: card.territory_id,
        symbol: card.is_wild ? "wild" : card.symbol!,
      })),
      myObjective: objective
        ? {
            id: objective.id,
            name: objective.name,
            description: objectiveDescription({
              type: objective.type,
              fallbackDescription: objective.description,
              params: objective.params,
            }),
            targetFactionName: objective.target_name,
          }
        : null,
    };

    return { revision: room.revision, snapshot };
  });
}
