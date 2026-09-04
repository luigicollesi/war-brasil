import "server-only";

import type { PoolClient } from "pg";
import { maneuverTraversalProfile } from "@/src/lib/game-barrier-rules";
import { playerGameCommand } from "@/src/lib/game-command";
import {
  resolveCommandPlayerBySession,
  type CommandPlayer,
} from "@/src/lib/game-command-player";
import type { GameCommandPatch } from "@/src/lib/game-command-patch";
import type { GameCommandRequestMetadata } from "@/src/lib/game-command-request";
import { getEffectiveGameTopology } from "@/src/lib/game-effective-topology-service";
import { objectiveWon } from "@/src/lib/game-objective-service";
import { maneuverMovableTroops } from "@/src/lib/game-rules";
import { bestTerritoryRoute } from "@/src/lib/territory-routing";
import { RoomError } from "@/src/lib/rooms";

type ManeuverRoom = {
  id: string;
  status: "order_roll" | "playing" | "finished";
  phase: string;
  current_player_id: string | null;
  round_number: number;
  jurassic_tunnel_territory_id: number | null;
};

type OwnedTerritory = {
  territory_id: number;
  troops: number;
  moved_in_turn: number;
};

type ManeuverInput = {
  fromTerritoryId: number;
  toTerritoryId: number;
  troops: number;
};

function normalizeRoomId(value: string) {
  if (!/^\d+$/.test(value)) {
    throw new RoomError("Partida não encontrada.", 404);
  }
  return value;
}

function positiveInteger(value: unknown, message: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new RoomError(message, 422);
  }
  return value;
}

async function loadRoom(client: PoolClient, roomId: string) {
  const room = (
    await client.query<ManeuverRoom>(
      `SELECT id,status,phase,current_player_id,round_number,
              jurassic_tunnel_territory_id
       FROM game_rooms
       WHERE id=$1`,
      [roomId],
    )
  ).rows[0];

  if (!room) throw new RoomError("Partida não encontrada.", 404);
  return room;
}

function assertManeuverTurn(room: ManeuverRoom, player: CommandPlayer) {
  if (
    room.status !== "playing" ||
    room.phase !== "maneuver" ||
    room.current_player_id !== player.id
  ) {
    throw new RoomError("Esta ação não está disponível neste momento.", 409, {
      roomStatus: room.status,
      roomPhase: room.phase,
      expectedPhase: "maneuver",
      currentPlayerId: room.current_player_id,
      requestPlayerId: player.id,
    });
  }
}

export async function executeManeuver(
  client: PoolClient,
  roomId: string,
  player: CommandPlayer,
  input: ManeuverInput,
): Promise<GameCommandPatch> {
  const room = await loadRoom(client, roomId);
  assertManeuverTurn(room, player);

  if (input.fromTerritoryId === input.toTerritoryId) {
    throw new RoomError(
      "Origem e destino precisam ser territórios diferentes.",
      422,
    );
  }

  const owned = (
    await client.query<OwnedTerritory>(
      `SELECT territory_id,troops,moved_in_turn
       FROM game_territories
       WHERE room_id=$1 AND owner_player_id=$2
       FOR UPDATE`,
      [room.id, player.id],
    )
  ).rows;

  const source = owned.find(
    (territory) => territory.territory_id === input.fromTerritoryId,
  );
  const destination = owned.find(
    (territory) => territory.territory_id === input.toTerritoryId,
  );

  if (!source || !destination) {
    throw new RoomError(
      "Você só pode deslocar tropas entre territórios próprios.",
      409,
      {
        fromTerritoryId: input.fromTerritoryId,
        toTerritoryId: input.toTerritoryId,
        requestPlayerId: player.id,
      },
    );
  }

  const topology = await getEffectiveGameTopology(client, {
    roomId: room.id,
    roundNumber: room.round_number,
    jurassicTunnelDestinationId: room.jurassic_tunnel_territory_id,
  });
  const route = bestTerritoryRoute(
    topology.connections,
    input.fromTerritoryId,
    input.toTerritoryId,
    owned.map((territory) => territory.territory_id),
  );

  if (route.kind === "unreachable") {
    throw new RoomError(
      "Não existe um caminho contínuo por territórios próprios entre a origem e o destino.",
      409,
      {
        fromTerritoryId: input.fromTerritoryId,
        toTerritoryId: input.toTerritoryId,
      },
    );
  }

  const traversal = maneuverTraversalProfile(route.barrierCount);
  if (traversal.kind === "blocked") {
    throw new RoomError(
      "A melhor rota ainda exige atravessar mais de uma barreira.",
      409,
      {
        fromTerritoryId: input.fromTerritoryId,
        toTerritoryId: input.toTerritoryId,
        minimumBarrierCount: route.barrierCount,
      },
    );
  }

  if (input.troops < traversal.minimumTroops) {
    const barrierName =
      traversal.kind === "barrier" ? route.barriers[0]?.barrierName : null;
    throw new RoomError(
      traversal.kind === "barrier"
        ? barrierName
          ? `A travessia de ${barrierName} exige mover pelo menos ${traversal.minimumTroops} tropas.`
          : `A travessia da barreira exige mover pelo menos ${traversal.minimumTroops} tropas.`
        : "Quantidade de tropas inválida.",
      409,
    );
  }

  const movableTroops = maneuverMovableTroops(
    source.troops,
    source.moved_in_turn,
  );
  if (input.troops > movableTroops) {
    throw new RoomError(
      "Estas tropas já foram deslocadas ou o território ficaria vazio.",
      409,
    );
  }

  const troopsArriving = input.troops - traversal.troopLoss;

  const updatedSource = (
    await client.query<{ troops: number; moved_in_turn: number }>(
      `UPDATE game_territories
       SET troops=troops-$3
       WHERE room_id=$1 AND territory_id=$2
       RETURNING troops,moved_in_turn`,
      [room.id, input.fromTerritoryId, input.troops],
    )
  ).rows[0];
  const updatedDestination = (
    await client.query<{ troops: number; moved_in_turn: number }>(
      `UPDATE game_territories
       SET troops=troops+$3,moved_in_turn=moved_in_turn+$3
       WHERE room_id=$1 AND territory_id=$2
       RETURNING troops,moved_in_turn`,
      [room.id, input.toTerritoryId, troopsArriving],
    )
  ).rows[0];

  const won = await objectiveWon(client, room.id, player.id, "troops_changed");

  return {
    ...(won
      ? {
          room: {
            status: "finished" as const,
            phase: "finished" as const,
            winnerPlayerId: player.id,
          },
        }
      : {}),
    territories: [
      {
        territoryId: input.fromTerritoryId,
        troops: updatedSource.troops,
        movedInTurn: updatedSource.moved_in_turn,
      },
      {
        territoryId: input.toTerritoryId,
        troops: updatedDestination.troops,
        movedInTurn: updatedDestination.moved_in_turn,
      },
    ],
  };
}

export async function maneuverCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
  metadata?: GameCommandRequestMetadata | null,
) {
  const roomId = normalizeRoomId(value);
  const fromTerritoryId = positiveInteger(
    input.fromTerritoryId,
    "Território de origem inválido.",
  );
  const toTerritoryId = positiveInteger(
    input.toTerritoryId,
    "Território de destino inválido.",
  );
  const troops = positiveInteger(
    input.troops,
    "Quantidade de tropas inválida.",
  );
  const normalizedInput = { fromTerritoryId, toTerritoryId, troops };

  return playerGameCommand<GameCommandPatch>(
    roomId,
    session,
    metadata,
    "maneuver",
    normalizedInput,
    async (client) => {
      const player = await resolveCommandPlayerBySession(client, roomId, session);
      return executeManeuver(client, roomId, player, normalizedInput);
    },
  );
}
