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

async function finalizeVictory(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  const result = await client.query(
    `UPDATE game.rooms
     SET status='finished',phase='finished',winner_player_id=$2
     WHERE id=$1 AND status<>'finished'`,
    [roomId, playerId],
  );

  if ((result.rowCount ?? 0) !== 1) return false;
  await finishDiceBalanceMatchForRoom(client, roomId);
  return true;
}

export async function evaluateGameVictory(
  client: PoolClient,
  roomId: string,
  playerId: string,
  event: ObjectiveEvent = "any",
) {
  const ruleset = await loadEffectiveRuleset(client, roomId);
  const won =
    ruleset === "objective"
      ? await objectiveVictoryConditionMet(client, roomId, playerId, event)
      : await supremacyVictoryConditionMet(client, roomId, playerId, event);

  if (!won) return false;
  return finalizeVictory(client, roomId, playerId);
}
