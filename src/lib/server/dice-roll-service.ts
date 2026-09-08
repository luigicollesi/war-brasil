import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { DICE_WEIGHT_TOTAL } from "@/src/lib/server/dice-balance-config";
import { loadCurrentMatchDiceBalance } from "@/src/lib/server/game-dice-balance-service";
import { rollCombatDiceBatch } from "@/src/lib/shared/combat-dice-engine";

type PlayerDiceStateRow = {
  pressure: number;
  batch_count: number;
  last_roll_round: number | null;
};

async function lockPlayerDiceState(
  client: PoolClient,
  input: { matchId: string; roomId: string; playerId: string },
) {
  const state = (
    await client.query<PlayerDiceStateRow>(
      `SELECT state.pressure,state.batch_count,state.last_roll_round
       FROM game.player_dice_states state
       JOIN game.matches match ON match.id = state.match_id
       JOIN game.players player ON player.id = state.player_id
       WHERE state.match_id = $1
         AND state.player_id = $2
         AND match.room_id = $3
         AND match.finished_at IS NULL
         AND player.room_id = $3
       FOR UPDATE OF state`,
      [input.matchId, input.playerId, input.roomId],
    )
  ).rows[0];

  if (!state) {
    throw new Error(
      `Estado de dados não encontrado para jogador ${input.playerId} ` +
        `no match ${input.matchId} da sala ${input.roomId}.`,
    );
  }
  return state;
}

export async function rollCombatDice(
  client: PoolClient,
  input: {
    roomId: string;
    playerId: string;
    roundNumber: number;
    diceCount: number;
  },
) {
  const { roomId, playerId, roundNumber, diceCount } = input;
  const { matchId, profile } = await loadCurrentMatchDiceBalance(client, roomId);

  if (profile.algorithm === "uniform") {
    return rollCombatDiceBatch({
      profile,
      state: null,
      roundNumber,
      diceCount,
      randomIntSource: randomInt,
      weightTotal: DICE_WEIGHT_TOTAL,
    }).dice;
  }

  const lockedState = await lockPlayerDiceState(client, {
    matchId,
    roomId,
    playerId,
  });
  const result = rollCombatDiceBatch({
    profile,
    state: {
      pressure: Number(lockedState.pressure),
      batchCount: Number(lockedState.batch_count),
      lastRollRound: lockedState.last_roll_round,
    },
    roundNumber,
    diceCount,
    randomIntSource: randomInt,
    weightTotal: DICE_WEIGHT_TOTAL,
  });

  if (!result.nextState) {
    throw new Error("Engine adaptativo não retornou estado atualizado.");
  }

  if (result.recoveredState) {
    console.error(
      `[war-brasil] estado de dados inconsistente no match ${matchId}, jogador ${playerId}; ` +
        "reiniciando estado adaptativo antes da rolagem.",
    );
  }

  const update = await client.query(
    `UPDATE game.player_dice_states
     SET pressure = $3,
         batch_count = $4,
         last_roll_round = $5,
         updated_at = NOW()
     WHERE match_id = $1 AND player_id = $2`,
    [
      matchId,
      playerId,
      result.nextState.pressure,
      result.nextState.batchCount,
      result.nextState.lastRollRound,
    ],
  );

  if ((update.rowCount ?? 0) !== 1) {
    throw new Error(
      `Estado de dados desapareceu durante a rolagem do match ${matchId}.`,
    );
  }

  return result.dice;
}
