import "server-only";

import type { PoolClient } from "pg";
import { maneuverTraversalProfile } from "@/src/lib/game-barrier-rules";
import { gameCommand } from "@/src/lib/game-command";
import type { GameCommandPatch } from "@/src/lib/game-command-patch";
import { getEffectiveGameTopology } from "@/src/lib/game-effective-topology-service";
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

type ManeuverPlayer = {
  id: string;
};

type OwnedTerritory = {
  territory_id: number;
  troops: number;
  moved_in_turn: number;
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

async function loadPlayer(
  client: PoolClient,
  roomId: string,
  session: string,
) {
  const player = (
    await client.query<ManeuverPlayer>(
      `SELECT id
       FROM room_players
       WHERE room_id=$1 AND player_session=$2
       FOR UPDATE`,
      [roomId, session],
    )
  ).rows[0];

  if (!player) {
    throw new RoomError("Você não pertence a esta partida.", 403);
  }
  return player;
}

function assertManeuverTurn(room: ManeuverRoom, player: ManeuverPlayer) {
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

export async function maneuverCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
) {
  const roomId = normalizeRoomId(value);
  const from = positiveInteger(
    input.fromTerritoryId,
    "Território de origem inválido.",
  );
  const to = positiveInteger(
    input.toTerritoryId,
    "Território de destino inválido.",
  );
  const troops = positiveInteger(
    input.troops,
    "Quantidade de tropas inválida.",
  );

  return gameCommand<GameCommandPatch>(roomId, async (client) => {
    const room = await loadRoom(client, roomId);
    const player = await loadPlayer(client, room.id, session);
    assertManeuverTurn(room, player);

    if (from === to) {
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

    const source = owned.find((territory) => territory.territory_id === from);
    const destination = owned.find((territory) => territory.territory_id === to);

    if (!source || !destination) {
      throw new RoomError(
        "Você só pode deslocar tropas entre territórios próprios.",
        409,
        {
          fromTerritoryId: from,
          toTerritoryId: to,
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
      from,
      to,
      owned.map((territory) => territory.territory_id),
    );

    if (route.kind === "unreachable") {
      throw new RoomError(
        "Não existe um caminho contínuo por territórios próprios entre a origem e o destino.",
        409,
        { fromTerritoryId: from, toTerritoryId: to },
      );
    }

    const traversal = maneuverTraversalProfile(route.barrierCount);
    if (traversal.kind === "blocked") {
      throw new RoomError(
        "A melhor rota ainda exige atravessar mais de uma barreira.",
        409,
        {
          fromTerritoryId: from,
          toTerritoryId: to,
          minimumBarrierCount: route.barrierCount,
          barrierNames: route.barriers
            .map((connection) => connection.barrierName)
            .filter((name): name is string => Boolean(name)),
        },
      );
    }

    if (troops < traversal.minimumTroops) {
      const barrierName =
        traversal.kind === "barrier" ? route.barriers[0]?.barrierName : null;
      throw new RoomError(
        traversal.kind === "barrier"
          ? barrierName
            ? `A travessia de ${barrierName} exige mover pelo menos ${traversal.minimumTroops} tropas.`
            : `A travessia da barreira exige mover pelo menos ${traversal.minimumTroops} tropas.`
          : "Quantidade de tropas inválida.",
        409,
        {
          fromTerritoryId: from,
          toTerritoryId: to,
          requestedTroops: troops,
          minimumTroops: traversal.minimumTroops,
          barrierCount: route.barrierCount,
          barrierName,
        },
      );
    }

    const movableTroops = maneuverMovableTroops(
      source.troops,
      source.moved_in_turn,
    );
    if (troops > movableTroops) {
      throw new RoomError(
        "Estas tropas já foram deslocadas ou o território ficaria vazio.",
        409,
        {
          fromTerritoryId: from,
          toTerritoryId: to,
          requestedTroops: troops,
          sourceTroops: source.troops,
          movedInTurn: source.moved_in_turn,
          movableTroops,
        },
      );
    }

    const troopsArriving = troops - traversal.troopLoss;

    const updatedSource = (
      await client.query<{ troops: number; moved_in_turn: number }>(
        `UPDATE game_territories
         SET troops=troops-$3
         WHERE room_id=$1 AND territory_id=$2
         RETURNING troops,moved_in_turn`,
        [room.id, from, troops],
      )
    ).rows[0];
    const updatedDestination = (
      await client.query<{ troops: number; moved_in_turn: number }>(
        `UPDATE game_territories
         SET troops=troops+$3,moved_in_turn=moved_in_turn+$3
         WHERE room_id=$1 AND territory_id=$2
         RETURNING troops,moved_in_turn`,
        [room.id, to, troopsArriving],
      )
    ).rows[0];

    return {
      territories: [
        {
          territoryId: from,
          troops: updatedSource.troops,
          movedInTurn: updatedSource.moved_in_turn,
        },
        {
          territoryId: to,
          troops: updatedDestination.troops,
          movedInTurn: updatedDestination.moved_in_turn,
        },
      ],
    };
  });
}
