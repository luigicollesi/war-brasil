import "server-only";

import type { PoolClient } from "pg";
import {
  advanceBattlePresentation,
  isBattle,
  saveBattle,
  type Battle,
  type BattleRoomState,
} from "@/src/lib/game-battle-service";
import { gameCommand } from "@/src/lib/game-command";
import {
  resolveCommandPlayerBySession,
  type CommandPlayer,
} from "@/src/lib/game-command-player";
import { objectiveWon } from "@/src/lib/game-objective-service";
import { RoomError } from "@/src/lib/rooms";

type ConquestRoom = BattleRoomState & {
  status: "order_roll" | "playing" | "finished";
  phase: string;
  current_player_id: string | null;
  last_battle: Battle | null;
};

type LockedTerritory = {
  territory_id: number;
  owner_player_id: string;
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
    await client.query<ConquestRoom>(
      `SELECT id,status,phase,current_player_id,
              pending_from_territory_id,pending_to_territory_id,last_battle
       FROM game_rooms
       WHERE id=$1`,
      [roomId],
    )
  ).rows[0];

  if (!room) throw new RoomError("Partida não encontrada.", 404);
  return room;
}

function assertAttackTurn(room: ConquestRoom, player: CommandPlayer) {
  if (
    room.status !== "playing" ||
    room.phase !== "attack" ||
    room.current_player_id !== player.id
  ) {
    throw new RoomError("Esta ação não está disponível neste momento.", 409, {
      roomStatus: room.status,
      roomPhase: room.phase,
      expectedPhase: "attack",
      currentPlayerId: room.current_player_id,
      requestPlayerId: player.id,
    });
  }
}

export async function executeCompleteConquest(
  client: PoolClient,
  roomId: string,
  player: CommandPlayer,
  troops: number,
) {
  const room = await loadRoom(client, roomId);
  assertAttackTurn(room, player);

  await advanceBattlePresentation(client, room);

  const from = room.pending_from_territory_id;
  const to = room.pending_to_territory_id;
  if (!from || !to) {
    throw new RoomError("Não há conquista pendente.", 409);
  }

  if (isBattle(room.last_battle)) {
    throw new RoomError(
      "Aguarde o resultado da batalha antes de transferir tropas.",
      409,
      { stage: room.last_battle.stage },
    );
  }

  const rows = (
    await client.query<LockedTerritory>(
      `SELECT territory_id,owner_player_id,troops
       FROM game_territories
       WHERE room_id=$1 AND territory_id=ANY($2::smallint[])
       FOR UPDATE`,
      [room.id, [from, to]],
    )
  ).rows;

  const source = rows.find((row) => row.territory_id === from);
  const target = rows.find((row) => row.territory_id === to);

  if (
    !source ||
    !target ||
    source.owner_player_id !== player.id ||
    target.owner_player_id !== player.id ||
    troops > source.troops - 1
  ) {
    throw new RoomError("Deslocamento de conquista inválido.", 409);
  }

  await client.query(
    `UPDATE game_territories
     SET troops=troops-$3
     WHERE room_id=$1 AND territory_id=$2`,
    [room.id, from, troops],
  );
  await client.query(
    `UPDATE game_territories
     SET troops=$3,moved_in_turn=0
     WHERE room_id=$1 AND territory_id=$2`,
    [room.id, to, troops],
  );
  await client.query(
    `UPDATE game_rooms
     SET pending_from_territory_id=NULL,pending_to_territory_id=NULL
     WHERE id=$1`,
    [room.id],
  );

  room.pending_from_territory_id = null;
  room.pending_to_territory_id = null;
  await saveBattle(client, room, null);

  await objectiveWon(client, room.id, player.id, "troops_changed");
  return null;
}

export async function completeConquestCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
) {
  const roomId = normalizeRoomId(value);
  const troops = positiveInteger(
    input.troops,
    "Quantidade de tropas inválida.",
  );

  return gameCommand(roomId, async (client) => {
    const player = await resolveCommandPlayerBySession(client, roomId, session);
    return executeCompleteConquest(client, roomId, player, troops);
  });
}
