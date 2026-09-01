import "server-only";

import type { PoolClient } from "pg";
import type { AttackMode } from "@/src/lib/game-barrier-rules";
import { objectiveWon } from "@/src/lib/game-objective-service";
import {
  nextBattlePresentationTransition,
  type BattleStage,
} from "@/src/lib/game-transitions";
import {
  ObjectiveConfigurationError,
  resolveObjectiveFallbacks,
} from "@/src/lib/objectives/objective-assignment-service";
import { RoomError } from "@/src/lib/rooms";

type BattleResult = {
  attacker: number[];
  defender: number[];
  attackerLosses: number;
  defenderLosses: number;
  conquered: boolean;
};

export type Battle = BattleResult & {
  attackerTerritoryId: number;
  defenderTerritoryId: number;
  attackerPlayerId: string;
  defenderPlayerId: string;
  stage: BattleStage;
  stageStartedAt: string;
  // Optional while previously persisted battles can still exist after a deploy.
  // Missing metadata is interpreted as a normal attack.
  attackMode?: AttackMode;
  barrierName?: string | null;
  attackerTroopsAfter?: number;
  defenderTroopsAfter?: number;
};

export type BattleRoomState = {
  id: string;
  last_battle: Battle | null;
  pending_from_territory_id: number | null;
  pending_to_territory_id: number | null;
};

type LockedTerritory = {
  territory_id: number;
  owner_player_id: string;
  troops: number;
};

export function battleAttackMode(battle: Pick<Battle, "attackMode">): AttackMode {
  return battle.attackMode === "barrier" ? "barrier" : "normal";
}

export function isBattle(value: unknown): value is Battle {
  if (!value || typeof value !== "object") return false;

  const battle = value as Partial<Battle>;
  return (
    typeof battle.attackerTerritoryId === "number" &&
    typeof battle.defenderTerritoryId === "number" &&
    typeof battle.attackerPlayerId === "string" &&
    typeof battle.defenderPlayerId === "string" &&
    typeof battle.stage === "string" &&
    typeof battle.stageStartedAt === "string" &&
    Array.isArray(battle.attacker) &&
    Array.isArray(battle.defender) &&
    (battle.attackMode === undefined ||
      battle.attackMode === "normal" ||
      battle.attackMode === "barrier") &&
    (battle.barrierName === undefined ||
      battle.barrierName === null ||
      typeof battle.barrierName === "string")
  );
}

export async function saveBattle(
  client: PoolClient,
  room: BattleRoomState,
  battle: Battle | null,
) {
  await client.query(
    "UPDATE game_rooms SET last_battle=$2 WHERE id=$1",
    [room.id, battle ? JSON.stringify(battle) : null],
  );
  room.last_battle = battle;
}

async function resolveFallbacks(
  client: PoolClient,
  roomId: string,
  targetPlayerId: string,
) {
  try {
    await resolveObjectiveFallbacks(client, roomId, targetPlayerId);
  } catch (error) {
    if (error instanceof ObjectiveConfigurationError) {
      throw new RoomError(error.message, 503);
    }
    throw error;
  }
}

async function eliminatePlayer(
  client: PoolClient,
  roomId: string,
  eliminatedPlayerId: string,
  conquerorPlayerId: string,
) {
  await client.query(
    `UPDATE room_players
     SET turn_position=NULL,bot_next_action_at=NULL
     WHERE room_id=$1 AND id=$2`,
    [roomId, eliminatedPlayerId],
  );

  await client.query(
    `UPDATE game_cards
     SET owner_player_id=$3
     WHERE room_id=$1 AND owner_player_id=$2 AND zone='hand'`,
    [roomId, eliminatedPlayerId, conquerorPlayerId],
  );
}

async function applyBattleOutcome(
  client: PoolClient,
  room: BattleRoomState,
  battle: Battle,
) {
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
      "O estado do combate foi alterado antes da resolução.",
      409,
      { battle },
    );
  }

  const attackerTroops = attacker.troops - battle.attackerLosses;
  const defenderTroops = defender.troops - battle.defenderLosses;

  if (attackerTroops < 1) {
    throw new RoomError(
      "O resultado do combate removeria a última tropa atacante.",
      500,
      {
        attackerTroops: attacker.troops,
        attackerLosses: battle.attackerLosses,
        attackMode: battleAttackMode(battle),
      },
    );
  }

  await client.query(
    `UPDATE game_territories
     SET troops=$3,moved_in_turn=0
     WHERE room_id=$1 AND territory_id=$2`,
    [room.id, attacker.territory_id, attackerTroops],
  );

  battle.attackerTroopsAfter = attackerTroops;
  battle.defenderTroopsAfter = Math.max(0, defenderTroops);

  if (defenderTroops > 0) {
    await client.query(
      `UPDATE game_territories
       SET troops=$3
       WHERE room_id=$1 AND territory_id=$2`,
      [room.id, defender.territory_id, defenderTroops],
    );
    return;
  }

  await client.query(
    `UPDATE game_territories
     SET owner_player_id=$3,troops=1,moved_in_turn=0
     WHERE room_id=$1 AND territory_id=$2`,
    [room.id, defender.territory_id, battle.attackerPlayerId],
  );
  await client.query(
    `UPDATE game_rooms
     SET conquered_this_turn=TRUE,
         pending_from_territory_id=$2,
         pending_to_territory_id=$3
     WHERE id=$1`,
    [room.id, battle.attackerTerritoryId, battle.defenderTerritoryId],
  );

  room.pending_from_territory_id = battle.attackerTerritoryId;
  room.pending_to_territory_id = battle.defenderTerritoryId;

  const defenderStillHasTerritory = await client.query(
    `SELECT 1
     FROM game_territories
     WHERE room_id=$1 AND owner_player_id=$2
     LIMIT 1`,
    [room.id, battle.defenderPlayerId],
  );

  if (!defenderStillHasTerritory.rowCount) {
    await eliminatePlayer(
      client,
      room.id,
      battle.defenderPlayerId,
      battle.attackerPlayerId,
    );

    if (
      !(await objectiveWon(
        client,
        room.id,
        battle.attackerPlayerId,
        "territory_control_changed",
      ))
    ) {
      await resolveFallbacks(client, room.id, battle.defenderPlayerId);
    }
  } else {
    await objectiveWon(
      client,
      room.id,
      battle.attackerPlayerId,
      "territory_control_changed",
    );
  }
}

export async function advanceBattlePresentation(
  client: PoolClient,
  room: BattleRoomState,
  nowMs = Date.now(),
) {
  const battle = room.last_battle;
  if (!isBattle(battle)) return false;

  const transition = nextBattlePresentationTransition(
    battle.stage,
    battle.stageStartedAt,
    nowMs,
  );

  if (!transition) return false;

  if (transition === "await_defender_roll") {
    battle.stage = "awaiting_defender_roll";
    battle.stageStartedAt = new Date(nowMs).toISOString();
    await saveBattle(client, room, battle);
    return true;
  }

  if (transition === "show_comparison") {
    battle.stage = "show_comparison";
    battle.stageStartedAt = new Date(nowMs).toISOString();
    await saveBattle(client, room, battle);
    return true;
  }

  if (transition === "resolve_battle") {
    await applyBattleOutcome(client, room, battle);
    battle.stage = "show_battle_result";
    battle.stageStartedAt = new Date(nowMs).toISOString();
    await saveBattle(client, room, battle);
    return true;
  }

  await saveBattle(client, room, null);
  return true;
}
