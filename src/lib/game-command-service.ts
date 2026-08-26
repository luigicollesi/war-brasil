import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { gameCommand } from "@/src/lib/game-command";
import { TERRITORY_METADATA } from "@/src/lib/game-config";
import {
  jurassicTunnelConnection,
  reachableTerritoryIds,
  type TerritoryConnection,
} from "@/src/lib/territory-connections";
import { RoomError } from "@/src/lib/rooms";

type CommandRoom = {
  id: string;
  status: "order_roll" | "playing" | "finished";
  order_roll_round: number;
  phase: string;
  current_player_id: string | null;
  jurassic_tunnel_territory_id: number | null;
};

type CommandPlayer = {
  id: string;
};

type OwnedTerritory = {
  territory_id: number;
  owner_player_id: string;
  troops: number;
  moved_in_turn: number;
};

type OrderPlayer = {
  id: string;
};

type OrderRoll = {
  player_id: string;
  roll_round: number;
  value: number;
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
  const result = await client.query<CommandRoom>(
    `SELECT id,status,order_roll_round,phase,current_player_id,jurassic_tunnel_territory_id
     FROM game_rooms
     WHERE id=$1`,
    [roomId],
  );

  const room = result.rows[0];
  if (!room) throw new RoomError("Partida não encontrada.", 404);
  return room;
}

async function playerFor(
  client: PoolClient,
  roomId: string,
  session: string,
) {
  const result = await client.query<CommandPlayer>(
    `SELECT id
     FROM room_players
     WHERE room_id=$1 AND player_session=$2
     FOR UPDATE`,
    [roomId, session],
  );

  const player = result.rows[0];
  if (!player) {
    throw new RoomError("Você não pertence a esta partida.", 403);
  }
  return player;
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

function chooseJurassicTunnelDestination(previous: number | null) {
  const candidates = Object.keys(TERRITORY_METADATA)
    .map(Number)
    .filter(
      (territoryId) =>
        territoryId !== 1 && territoryId !== 3 && territoryId !== previous,
    );

  return candidates[randomInt(0, candidates.length)];
}

async function ensureJurassicTunnel(client: PoolClient, room: CommandRoom) {
  if (room.status !== "playing" || room.jurassic_tunnel_territory_id) return;

  const destination = chooseJurassicTunnelDestination(null);
  await client.query(
    "UPDATE game_rooms SET jurassic_tunnel_territory_id=$2 WHERE id=$1",
    [room.id, destination],
  );
  room.jurassic_tunnel_territory_id = destination;
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

export async function rollOrderDieCommand(value: string, session: string) {
  const roomId = normalizeRoomId(value);

  return gameCommand(roomId, async (client) => {
    const room = await loadRoom(client, roomId);
    if (room.status !== "order_roll") {
      throw new RoomError("O sorteio de ordem não está disponível.", 409);
    }

    const player = await playerFor(client, room.id, session);
    const players = (
      await client.query<OrderPlayer>(
        "SELECT id FROM room_players WHERE room_id=$1 ORDER BY joined_at",
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

    const current = eligible(players, rolls, room.order_roll_round);
    const nextPlayerId = current.find(
      (playerId) =>
        !rolls.some(
          (roll) =>
            roll.player_id === playerId &&
            roll.roll_round === room.order_roll_round,
        ),
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
  });
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

  return gameCommand(roomId, async (client) => {
    const room = await loadRoom(client, roomId);
    const player = await playerFor(client, room.id, session);
    assertTurn(room, player, "maneuver");
    await ensureJurassicTunnel(client, room);

    if (from === to) {
      throw new RoomError(
        "Origem e destino precisam ser territórios diferentes.",
        422,
      );
    }

    const owned = (
      await client.query<OwnedTerritory>(
        `SELECT territory_id,owner_player_id,troops,moved_in_turn
         FROM game_territories
         WHERE room_id=$1 AND owner_player_id=$2
         FOR UPDATE`,
        [room.id, player.id],
      )
    ).rows;

    const source = owned.find((territory) => territory.territory_id === from);
    const destination = owned.find(
      (territory) => territory.territory_id === to,
    );

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

    const connectionRows = (
      await client.query<{
        territory_a: number;
        territory_b: number;
        is_passable: boolean;
        barrier_name: string | null;
        description: string | null;
      }>(
        `SELECT territory_a,territory_b,is_passable,barrier_name,description
         FROM territory_connections
         WHERE is_passable=TRUE`,
      )
    ).rows;

    const connections: TerritoryConnection[] = connectionRows.map(
      (connection) => ({
        territoryA: connection.territory_a,
        territoryB: connection.territory_b,
        exists: true,
        passable: connection.is_passable,
        barrierName: connection.barrier_name,
        description: connection.description,
      }),
    );

    const tunnelConnection = jurassicTunnelConnection(
      room.jurassic_tunnel_territory_id,
    );
    if (tunnelConnection) connections.push(tunnelConnection);

    const reachable = new Set(
      reachableTerritoryIds(
        connections,
        from,
        owned.map((territory) => territory.territory_id),
      ),
    );

    if (!reachable.has(to)) {
      throw new RoomError(
        "Não existe um caminho contínuo por territórios próprios entre a origem e o destino.",
        409,
        { fromTerritoryId: from, toTerritoryId: to },
      );
    }

    if (troops > source.troops - source.moved_in_turn - 1) {
      throw new RoomError(
        "Estas tropas já foram deslocadas ou o território ficaria vazio.",
        409,
        {
          fromTerritoryId: from,
          toTerritoryId: to,
          requestedTroops: troops,
          sourceTroops: source.troops,
          movedInTurn: source.moved_in_turn,
        },
      );
    }

    await client.query(
      "UPDATE game_territories SET troops=troops-$3 WHERE room_id=$1 AND territory_id=$2",
      [room.id, from, troops],
    );
    await client.query(
      `UPDATE game_territories
       SET troops=troops+$3,moved_in_turn=moved_in_turn+$3
       WHERE room_id=$1 AND territory_id=$2`,
      [room.id, to, troops],
    );

    return null;
  });
}
