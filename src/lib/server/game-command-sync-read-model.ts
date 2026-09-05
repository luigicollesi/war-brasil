import "server-only";

import type { PoolClient } from "pg";
import { isBattle, type Battle } from "@/src/lib/game-battle-service";
import type { GameCommandPatch } from "@/src/lib/game-command-patch";
import type { GamePrivatePatch } from "@/src/lib/game-private-patch";
import type { PlayerColor } from "@/src/lib/lobby";
import { RoomError } from "@/src/lib/rooms";

type RoomPatchRow = {
  status: "waiting" | "order_roll" | "playing" | "finished";
  phase:
    | "cards"
    | "trade"
    | "reinforcement"
    | "attack"
    | "maneuver"
    | "end_turn"
    | "finished";
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

type TerritoryPatchRow = {
  territory_id: number;
  owner_player_id: string;
  color: PlayerColor;
  troops: number;
  moved_in_turn: number;
};

type HandCardRow = {
  id: string;
  territory_id: number | null;
  symbol: "leaf" | "gold" | "water" | null;
  is_wild: boolean;
};

function presentationPending(battle: Battle | null) {
  return Boolean(
    battle &&
      (battle.stage === "show_attacker_result" ||
        battle.stage === "show_defender_result" ||
        battle.stage === "show_comparison" ||
        battle.stage === "show_battle_result"),
  );
}

function requiredActorId(room: RoomPatchRow, battle: Battle | null) {
  if (presentationPending(battle)) return null;
  if (battle?.stage === "awaiting_attacker_roll") return battle.attackerPlayerId;
  if (battle?.stage === "awaiting_defender_roll") return battle.defenderPlayerId;
  if (room.status === "playing") return room.current_player_id;
  return null;
}

export async function readRoomCommandPatch(
  client: PoolClient,
  roomId: string,
): Promise<NonNullable<GameCommandPatch["room"]>> {
  const room = (
    await client.query<RoomPatchRow>(
      `SELECT status,phase,current_player_id,turn_number,round_number,
              jurassic_tunnel_territory_id,reinforcements_remaining,
              winner_player_id,pending_from_territory_id,
              pending_to_territory_id,last_battle
       FROM game_rooms
       WHERE id=$1`,
      [roomId],
    )
  ).rows[0];

  if (!room) {
    throw new RoomError("Partida não encontrada.", 404);
  }

  const battle = isBattle(room.last_battle) ? room.last_battle : null;
  const actorId = requiredActorId(room, battle);
  const actorIsBot = actorId
    ? Boolean(
        (
          await client.query<{ is_bot: boolean }>(
            `SELECT is_bot
             FROM room_players
             WHERE room_id=$1 AND id=$2`,
            [roomId, actorId],
          )
        ).rows[0]?.is_bot,
      )
    : false;
  const automaticAdvancePending = presentationPending(battle) || actorIsBot;

  return {
    status: room.status,
    phase: room.phase,
    currentPlayerId: room.current_player_id,
    turnNumber: room.turn_number,
    roundNumber: room.round_number,
    jurassicTunnelDestinationId: room.jurassic_tunnel_territory_id,
    reinforcementsRemaining: room.reinforcements_remaining,
    winnerPlayerId: room.winner_player_id,
    automaticAdvancePending,
    pendingConquest:
      room.pending_from_territory_id !== null &&
      room.pending_to_territory_id !== null
        ? {
            fromTerritoryId: room.pending_from_territory_id,
            toTerritoryId: room.pending_to_territory_id,
          }
        : null,
    battle,
  };
}

export async function readTerritoryCommandPatches(
  client: PoolClient,
  roomId: string,
  territoryIds?: number[],
): Promise<NonNullable<GameCommandPatch["territories"]>> {
  const uniqueIds = territoryIds ? [...new Set(territoryIds)] : null;
  if (uniqueIds && uniqueIds.length === 0) return [];

  const rows = (
    await client.query<TerritoryPatchRow>(
      uniqueIds
        ? `SELECT t.territory_id,t.owner_player_id,p.color,t.troops,t.moved_in_turn
           FROM game_territories t
           JOIN room_players p ON p.id=t.owner_player_id
           WHERE t.room_id=$1 AND t.territory_id=ANY($2::smallint[])
           ORDER BY t.territory_id`
        : `SELECT t.territory_id,t.owner_player_id,p.color,t.troops,t.moved_in_turn
           FROM game_territories t
           JOIN room_players p ON p.id=t.owner_player_id
           WHERE t.room_id=$1
           ORDER BY t.territory_id`,
      uniqueIds ? [roomId, uniqueIds] : [roomId],
    )
  ).rows;

  return rows.map((row) => ({
    territoryId: row.territory_id,
    ownerPlayerId: row.owner_player_id,
    ownerColor: row.color,
    troops: row.troops,
    movedInTurn: row.moved_in_turn,
  }));
}

export async function readTerritoryMovementPatches(
  client: PoolClient,
  roomId: string,
  ownerPlayerId?: string,
): Promise<NonNullable<GameCommandPatch["territories"]>> {
  const rows = (
    await client.query<{ territory_id: number; moved_in_turn: number }>(
      ownerPlayerId
        ? `SELECT territory_id,moved_in_turn
           FROM game_territories
           WHERE room_id=$1 AND owner_player_id=$2
           ORDER BY territory_id`
        : `SELECT territory_id,moved_in_turn
           FROM game_territories
           WHERE room_id=$1
           ORDER BY territory_id`,
      ownerPlayerId ? [roomId, ownerPlayerId] : [roomId],
    )
  ).rows;

  return rows.map((row) => ({
    territoryId: row.territory_id,
    movedInTurn: row.moved_in_turn,
  }));
}

export async function readPlayerHandPrivatePatch(
  client: PoolClient,
  roomId: string,
  playerId: string,
): Promise<GamePrivatePatch> {
  const cards = (
    await client.query<HandCardRow>(
      `SELECT id,territory_id,symbol,is_wild
       FROM game_cards
       WHERE room_id=$1 AND owner_player_id=$2 AND zone='hand'
       ORDER BY id`,
      [roomId, playerId],
    )
  ).rows;

  return {
    myCards: cards.map((card) => {
      if (!card.is_wild && !card.symbol) {
        throw new RoomError("Carta de território possui símbolo inválido.", 500);
      }
      return {
        id: card.id,
        territoryId: card.territory_id,
        symbol: card.is_wild ? "wild" : card.symbol!,
      };
    }),
  };
}
