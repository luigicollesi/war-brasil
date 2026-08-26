import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import {
  advanceBattlePresentation,
  isBattle,
  saveBattle,
  type Battle,
  type BattleRoomState,
} from "@/src/lib/game-battle-service";
import { gameCommand } from "@/src/lib/game-command";
import { TERRITORY_METADATA } from "@/src/lib/game-config";
import { objectiveWon } from "@/src/lib/game-objective-service";
import { resolveBattle } from "@/src/lib/game-rules";
import {
  isJurassicTunnelConnection,
} from "@/src/lib/territory-connections";
import { getTerritoryConnection } from "@/src/lib/territory-connections.server";
import { RoomError } from "@/src/lib/rooms";

type CombatRoom = BattleRoomState & {
  status: "order_roll" | "playing" | "finished";
  phase: string;
  current_player_id: string | null;
  jurassic_tunnel_territory_id: number | null;
};

type CombatPlayer = {
  id: string;
};

type LockedTerritory = {
  territory_id: number;
  owner_player_id: string;
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
  const result = await client.query<CombatRoom>(
    `SELECT id,status,phase,current_player_id,jurassic_tunnel_territory_id,
            pending_from_territory_id,pending_to_territory_id,last_battle
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
  const result = await client.query<CombatPlayer>(
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

function assertAttackTurn(room: CombatRoom, player: CombatPlayer) {
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

function chooseJurassicTunnelDestination(previous: number | null) {
  const candidates = Object.keys(TERRITORY_METADATA)
    .map(Number)
    .filter(
      (territoryId) =>
        territoryId !== 1 && territoryId !== 3 && territoryId !== previous,
    );

  return candidates[randomInt(0, candidates.length)];
}

async function ensureJurassicTunnel(client: PoolClient, room: CombatRoom) {
  if (room.status !== "playing" || room.jurassic_tunnel_territory_id) return;

  const destination = chooseJurassicTunnelDestination(null);
  await client.query(
    "UPDATE game_rooms SET jurassic_tunnel_territory_id=$2 WHERE id=$1",
    [room.id, destination],
  );
  room.jurassic_tunnel_territory_id = destination;
}

export async function attackCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
) {
  const roomId = normalizeRoomId(value);
  const from = positiveInteger(
    input.fromTerritoryId,
    "Território atacante inválido.",
  );
  const to = positiveInteger(
    input.toTerritoryId,
    "Território defensor inválido.",
  );

  return gameCommand(roomId, async (client) => {
    const room = await loadRoom(client, roomId);
    const player = await playerFor(client, room.id, session);
    assertAttackTurn(room, player);

    await advanceBattlePresentation(client, room);
    await ensureJurassicTunnel(client, room);

    if (isBattle(room.last_battle)) {
      throw new RoomError("Aguarde a resolução do combate atual.", 409, {
        stage: room.last_battle.stage,
      });
    }

    if (room.pending_from_territory_id) {
      throw new RoomError(
        "Conclua o deslocamento da conquista antes de atacar novamente.",
        409,
        {
          pendingFromTerritoryId: room.pending_from_territory_id,
          pendingToTerritoryId: room.pending_to_territory_id,
        },
      );
    }

    const tunnelActive = isJurassicTunnelConnection(
      room.jurassic_tunnel_territory_id,
      from,
      to,
    );
    const connection = await getTerritoryConnection(client, from, to);

    if (!tunnelActive && !connection.exists) {
      throw new RoomError(
        "Os territórios não possuem fronteira militar.",
        422,
        { fromTerritoryId: from, toTerritoryId: to, connection },
      );
    }

    if (!tunnelActive && !connection.passable) {
      throw new RoomError(
        connection.barrierName
          ? `Fronteira bloqueada — ${connection.barrierName}`
          : "Fronteira militar bloqueada.",
        422,
        { fromTerritoryId: from, toTerritoryId: to, connection },
      );
    }

    const rows = (
      await client.query<LockedTerritory>(
        `SELECT territory_id,owner_player_id,troops,moved_in_turn
         FROM game_territories
         WHERE room_id=$1 AND territory_id=ANY($2::smallint[])
         FOR UPDATE`,
        [room.id, [from, to]],
      )
    ).rows;

    const attacker = rows.find((row) => row.territory_id === from);
    const defender = rows.find((row) => row.territory_id === to);

    if (
      !attacker ||
      !defender ||
      attacker.owner_player_id !== player.id ||
      defender.owner_player_id === player.id ||
      attacker.troops < 2
    ) {
      throw new RoomError("Ataque inválido.", 409, {
        fromTerritoryId: from,
        toTerritoryId: to,
        requestPlayerId: player.id,
        attacker: attacker
          ? {
              ownerPlayerId: attacker.owner_player_id,
              troops: attacker.troops,
            }
          : null,
        defender: defender
          ? {
              ownerPlayerId: defender.owner_player_id,
              troops: defender.troops,
            }
          : null,
      });
    }

    const battle: Battle = {
      attackerTerritoryId: from,
      defenderTerritoryId: to,
      attackerPlayerId: player.id,
      defenderPlayerId: defender.owner_player_id,
      stage: "awaiting_attacker_roll",
      stageStartedAt: new Date().toISOString(),
      attacker: [],
      defender: [],
      attackerLosses: 0,
      defenderLosses: 0,
      conquered: false,
    };

    await saveBattle(client, room, battle);
    return battle;
  });
}

export async function rollBattleDiceCommand(value: string, session: string) {
  const roomId = normalizeRoomId(value);

  return gameCommand(roomId, async (client) => {
    const room = await loadRoom(client, roomId);
    const player = await playerFor(client, room.id, session);

    if (room.status !== "playing" || room.phase !== "attack") {
      throw new RoomError(
        "Os dados de combate não estão disponíveis neste momento.",
        409,
        {
          roomStatus: room.status,
          roomPhase: room.phase,
          requestPlayerId: player.id,
        },
      );
    }

    await advanceBattlePresentation(client, room);

    const battle = room.last_battle;
    if (!isBattle(battle)) {
      throw new RoomError("Não há combate aguardando dados.", 409);
    }

    const rows = (
      await client.query<LockedTerritory>(
        `SELECT territory_id,owner_player_id,troops,moved_in_turn
         FROM game_territories
         WHERE room_id=$1 AND territory_id=ANY($2::smallint[])
         FOR UPDATE`,
        [room.id, [battle.attackerTerritoryId, battle.defenderTerritoryId]],
      )
    ).rows;

    const attacker = rows.find(
      (row) => row.territory_id === battle.attackerTerritoryId,
    );
    const defender = rows.find(
      (row) => row.territory_id === battle.defenderTerritoryId,
    );

    if (!attacker || !defender) {
      throw new RoomError(
        "Os territórios do combate não foram encontrados.",
        409,
      );
    }

    if (battle.stage === "awaiting_attacker_roll") {
      if (player.id !== battle.attackerPlayerId) {
        throw new RoomError("Apenas o atacante pode rolar agora.", 403);
      }

      battle.attacker = Array.from(
        { length: Math.min(3, attacker.troops - 1) },
        () => randomInt(1, 7),
      ).sort((a, b) => b - a);
      battle.stage = "show_attacker_result";
      battle.stageStartedAt = new Date().toISOString();
      await saveBattle(client, room, battle);
      return battle;
    }

    if (battle.stage === "awaiting_defender_roll") {
      if (player.id !== battle.defenderPlayerId) {
        throw new RoomError("Apenas o defensor pode rolar agora.", 403);
      }

      battle.defender = Array.from(
        { length: Math.min(3, defender.troops) },
        () => randomInt(1, 7),
      ).sort((a, b) => b - a);

      const resolved = resolveBattle(battle.attacker, battle.defender);
      battle.attacker = resolved.attacker;
      battle.defender = resolved.defender;
      battle.attackerLosses = resolved.attackerLosses;
      battle.defenderLosses = resolved.defenderLosses;
      battle.conquered = resolved.defenderLosses === defender.troops;
      battle.stage = "show_defender_result";
      battle.stageStartedAt = new Date().toISOString();
      await saveBattle(client, room, battle);
      return battle;
    }

    throw new RoomError(
      "Aguarde a próxima etapa visual do combate.",
      409,
      { stage: battle.stage },
    );
  });
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
    const room = await loadRoom(client, roomId);
    const player = await playerFor(client, room.id, session);
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
        `SELECT territory_id,owner_player_id,troops,moved_in_turn
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
       SET troops=$3,moved_in_turn=$3
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
    await objectiveWon(client, room.id, player.id);

    return null;
  });
}
