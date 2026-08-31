import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import {
  advanceBattlePresentation,
  battleAttackMode,
  isBattle,
  saveBattle,
  type Battle,
  type BattleRoomState,
} from "@/src/lib/game-battle-service";
import { attackProfile, type AttackMode } from "@/src/lib/game-barrier-rules";
import { gameCommand } from "@/src/lib/game-command";
import { isAttackOriginBlocked } from "@/src/lib/events/event-attack-rules";
import { getEffectiveGameTopology } from "@/src/lib/game-effective-topology-service";
import { resolveBattle } from "@/src/lib/game-rules";
import { findTerritoryConnection } from "@/src/lib/territory-connections";
import { RoomError } from "@/src/lib/rooms";

type CombatRoom = BattleRoomState & {
  status: "order_roll" | "playing" | "finished";
  phase: string;
  current_player_id: string | null;
  round_number: number;
  jurassic_tunnel_territory_id: number | null;
};

type CombatPlayer = {
  id: string;
  faction_name: string;
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

function rollCombatDie(player: CombatPlayer) {
  return randomInt(1, player.faction_name === "Lari" ? 4 : 7);
}

async function loadRoom(client: PoolClient, roomId: string) {
  const result = await client.query<CombatRoom>(
    `SELECT id,status,phase,current_player_id,round_number,
            jurassic_tunnel_territory_id,pending_from_territory_id,
            pending_to_territory_id,last_battle
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
    `SELECT id,faction_name
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

    const topology = await getEffectiveGameTopology(client, {
      roomId: room.id,
      roundNumber: room.round_number,
      jurassicTunnelDestinationId: room.jurassic_tunnel_territory_id,
    });

    if (isAttackOriginBlocked(topology.resolvedEventEffects, from)) {
      throw new RoomError(
        "Este território não pode iniciar ataques durante a anomalia atual.",
        409,
        { fromTerritoryId: from, eventId: topology.eventId },
      );
    }

    const connection = findTerritoryConnection(topology.connections, from, to);
    if (!connection.exists) {
      throw new RoomError(
        "Os territórios não possuem fronteira militar.",
        422,
        { fromTerritoryId: from, toTerritoryId: to, connection },
      );
    }

    const attackMode: AttackMode = connection.passable ? "normal" : "barrier";

    const rows = (
      await client.query<LockedTerritory>(
        `SELECT territory_id,owner_player_id,troops
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
      defender.owner_player_id === player.id
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

    const profile = attackProfile(attacker.troops, attackMode);
    if (profile.kind === "unavailable") {
      throw new RoomError(
        attackMode === "barrier"
          ? connection.barrierName
            ? `Ataque através de ${connection.barrierName} exige pelo menos ${profile.minimumTroops} tropas.`
            : `Ataque através desta barreira exige pelo menos ${profile.minimumTroops} tropas.`
          : "Ataque inválido.",
        409,
        {
          fromTerritoryId: from,
          toTerritoryId: to,
          attackMode,
          barrierName: attackMode === "barrier" ? connection.barrierName : null,
          minimumTroops: profile.minimumTroops,
          attackerTroops: attacker.troops,
        },
      );
    }

    const battle: Battle = {
      attackerTerritoryId: from,
      defenderTerritoryId: to,
      attackerPlayerId: player.id,
      defenderPlayerId: defender.owner_player_id,
      stage: "awaiting_attacker_roll",
      stageStartedAt: new Date().toISOString(),
      attackMode,
      barrierName: attackMode === "barrier" ? connection.barrierName : null,
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

export async function cancelBattleCommand(value: string, session: string) {
  const roomId = normalizeRoomId(value);

  return gameCommand(roomId, async (client) => {
    const room = await loadRoom(client, roomId);
    const player = await playerFor(client, room.id, session);
    assertAttackTurn(room, player);

    const battle = room.last_battle;
    if (!isBattle(battle)) {
      throw new RoomError("Não há ataque para cancelar.", 409);
    }

    if (battle.attackerPlayerId !== player.id) {
      throw new RoomError("Apenas o atacante pode cancelar este ataque.", 403);
    }

    if (
      battle.stage !== "awaiting_attacker_roll" ||
      battle.attacker.length > 0 ||
      battle.defender.length > 0
    ) {
      throw new RoomError(
        "O ataque não pode mais ser cancelado depois da primeira rolagem.",
        409,
        { stage: battle.stage },
      );
    }

    await saveBattle(client, room, null);
    return { cancelled: true };
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
        `SELECT territory_id,owner_player_id,troops
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

    if (
      !attacker ||
      !defender ||
      attacker.owner_player_id !== battle.attackerPlayerId ||
      defender.owner_player_id !== battle.defenderPlayerId
    ) {
      throw new RoomError(
        "O estado dos territórios do combate foi alterado.",
        409,
      );
    }

    if (battle.stage === "awaiting_attacker_roll") {
      if (player.id !== battle.attackerPlayerId) {
        throw new RoomError("Apenas o atacante pode rolar agora.", 403);
      }

      const profile = attackProfile(attacker.troops, battleAttackMode(battle));
      if (profile.kind !== "available") {
        throw new RoomError(
          "O território atacante não possui tropas suficientes para esta rolagem.",
          409,
          {
            attackMode: battleAttackMode(battle),
            attackerTroops: attacker.troops,
            minimumTroops: profile.minimumTroops,
          },
        );
      }

      battle.attacker = Array.from(
        { length: profile.diceCount },
        () => rollCombatDie(player),
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
        () => rollCombatDie(player),
      ).sort((a, b) => b - a);

      const resolved = resolveBattle(battle.attacker, battle.defender);
      const profile = attackProfile(attacker.troops, battleAttackMode(battle));
      if (profile.kind !== "available") {
        throw new RoomError(
          "O estado do território atacante ficou incompatível com o combate.",
          409,
          {
            attackMode: battleAttackMode(battle),
            attackerTroops: attacker.troops,
            minimumTroops: profile.minimumTroops,
          },
        );
      }

      const attackerLosses =
        resolved.attackerLosses * profile.attackerLossPerComparison;
      if (attackerLosses >= attacker.troops) {
        throw new RoomError(
          "O resultado calculado removeria a última tropa atacante.",
          500,
          {
            attackMode: battleAttackMode(battle),
            attackerTroops: attacker.troops,
            comparisonLosses: resolved.attackerLosses,
            attackerLosses,
          },
        );
      }

      battle.attacker = resolved.attacker;
      battle.defender = resolved.defender;
      battle.attackerLosses = attackerLosses;
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
