import "server-only";

import type { PlayerColor } from "@/src/lib/lobby";
import type { GameSnapshot } from "@/src/lib/game-contract";
import { isBattle } from "@/src/lib/game-battle-service";
import { gameQuery } from "@/src/lib/game-query";
import { getBaseTerritoryConnections } from "@/src/lib/game-topology-service";
import { RoomError } from "@/src/lib/rooms";

type SnapshotRoom = {
  id: string;
  code: string;
  status: "order_roll" | "playing" | "finished";
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
};

type SnapshotTerritory = {
  territory_id: number;
  owner_player_id: string;
  color: PlayerColor;
  troops: number;
  moved_in_turn: number;
};

type SnapshotRoll = {
  player_id: string;
  roll_round: number;
  value: number;
};

type SnapshotCard = {
  id: string;
  territory_id: number | null;
  symbol: "leaf" | "gold" | "water" | null;
  is_wild: boolean;
};

type SnapshotObjective = {
  id: string;
  name: string;
  description: string;
  target_name: string | null;
};

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

function histories(players: SnapshotPlayer[], rolls: SnapshotRoll[]) {
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

function eligible(
  players: SnapshotPlayer[],
  rolls: SnapshotRoll[],
  round: number,
) {
  return unresolved(
    histories(
      players,
      rolls.filter((roll) => roll.roll_round < round),
    ),
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
        `SELECT id,faction_name,color,turn_position,player_session=$2 is_me
         FROM room_players
         WHERE room_id=$1
         ORDER BY turn_position NULLS LAST,joined_at`,
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
            await client.query<SnapshotRoll>(
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

    const objective = (
      await client.query<SnapshotObjective>(
        `SELECT o.id,o.name,o.description,t.faction_name target_name
         FROM game_player_objectives a
         JOIN objectives o ON o.id=a.objective_id
         LEFT JOIN room_players t ON t.id=a.target_player_id
         WHERE a.room_id=$1 AND a.player_id=$2`,
        [room.id, me.id],
      )
    ).rows[0];

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
        ? eligible(players, rolls, room.order_roll_round)
        : [];
    const orderRollPlayerId =
      eligiblePlayerIds.find(
        (playerId) =>
          !rolls.some(
            (roll) =>
              roll.player_id === playerId &&
              roll.roll_round === room.order_roll_round,
          ),
      ) ?? null;
    const lastOrderRollPlayerId =
      rolls
        .filter((roll) => roll.roll_round === room.order_roll_round)
        .at(-1)?.player_id ?? null;

    const connections = [...(await getBaseTerritoryConnections(client))];

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
        reinforcementsRemaining: room.reinforcements_remaining,
        winnerPlayerId: room.winner_player_id,
        pendingConquest:
          room.pending_from_territory_id !== null &&
          room.pending_to_territory_id !== null
            ? {
                fromTerritoryId: room.pending_from_territory_id,
                toTerritoryId: room.pending_to_territory_id,
              }
            : null,
        battle: isBattle(room.last_battle) ? room.last_battle : null,
      },
      players: players.map((player) => ({
        id: player.id,
        factionName: player.faction_name,
        color: player.color,
        turnPosition: player.turn_position,
        isMe: Boolean(player.is_me),
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
            description: objective.description,
            targetFactionName: objective.target_name,
          }
        : null,
    };

    return { revision: room.revision, snapshot };
  });
}
