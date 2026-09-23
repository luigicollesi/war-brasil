import "server-only";

import type { PoolClient } from "pg";
import { isGameRuleset, type GameRuleset } from "@/src/lib/game-mode";
import { finishDiceBalanceMatchForRoom } from "@/src/lib/server/game-dice-balance-service";
import {
  objectiveVictoryConditionMet,
  type ObjectiveEvent,
} from "@/src/lib/server/game-objective-service";
import { supremacyVictoryConditionMet } from "@/src/lib/server/game-supremacy-service";

async function loadEffectiveRuleset(client: PoolClient, roomId: string) {
  const row = (
    await client.query<{ ruleset: GameRuleset }>(
      `SELECT COALESCE(match.ruleset_snapshot, room.ruleset, 'objective') AS ruleset
       FROM game.rooms room
       LEFT JOIN game.matches match ON match.id=room.current_match_id
       WHERE room.id=$1`,
      [roomId],
    )
  ).rows[0];

  if (!row || !isGameRuleset(row.ruleset)) {
    throw new Error(`Ruleset autoritativo inválido para a sala ${roomId}.`);
  }
  return row.ruleset;
}

async function victoryConditionMet(
  client: PoolClient,
  roomId: string,
  playerId: string,
  ruleset: GameRuleset,
  event: ObjectiveEvent,
) {
  return ruleset === "objective"
    ? objectiveVictoryConditionMet(client, roomId, playerId, event)
    : supremacyVictoryConditionMet(client, roomId, playerId, event);
}

export async function evaluateGameVictories(
  client: PoolClient,
  roomId: string,
  playerIds: readonly string[],
  event: ObjectiveEvent = "any",
) {
  const uniquePlayerIds = [...new Set(playerIds)];
  if (uniquePlayerIds.length === 0) return [];

  const ruleset = await loadEffectiveRuleset(client, roomId);
  const winners: string[] = [];
  for (const playerId of uniquePlayerIds) {
    if (
      await victoryConditionMet(
        client,
        roomId,
        playerId,
        ruleset,
        event,
      )
    ) {
      winners.push(playerId);
    }
  }
  return winners;
}

export async function finalizeGameVictories(
  client: PoolClient,
  roomId: string,
  playerIds: readonly string[],
) {
  const winners = [...new Set(playerIds)];
  if (winners.length === 0) return false;

  const result = await client.query(
    `UPDATE game.rooms
     SET status='finished',phase='finished',winner_player_id=$2
     WHERE id=$1 AND status<>'finished'`,
    [roomId, winners[0]],
  );

  if ((result.rowCount ?? 0) !== 1) return false;

  await client.query("DELETE FROM game.room_winners WHERE room_id=$1", [roomId]);
  await client.query(
    `INSERT INTO game.room_winners(room_id,player_id)
     SELECT $1::bigint, winner_id
     FROM unnest($2::bigint[]) AS winner_id`,
    [roomId, winners],
  );

  await finishDiceBalanceMatchForRoom(client, roomId);
  return true;
}

export async function evaluateGameVictory(
  client: PoolClient,
  roomId: string,
  playerId: string,
  event: ObjectiveEvent = "any",
) {
  const winners = await evaluateGameVictories(
    client,
    roomId,
    [playerId],
    event,
  );
  if (winners.length === 0) return false;
  return finalizeGameVictories(client, roomId, winners);
}
