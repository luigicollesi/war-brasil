import "server-only";

import type { PoolClient } from "pg";
import { gameCommand } from "@/src/lib/game-command";
import {
  resolveCommandPlayerBySession,
  type CommandPlayer,
} from "@/src/lib/game-command-player";
import type { GameCommandPatch } from "@/src/lib/game-command-patch";
import type { CardSymbol } from "@/src/lib/game-config";
import { objectiveWon } from "@/src/lib/game-objective-service";
import { isValidTrade, tradeValue } from "@/src/lib/game-rules";
import { RoomError } from "@/src/lib/rooms";

type TroopRoom = {
  id: string;
  status: "order_roll" | "playing" | "finished";
  phase: string;
  current_player_id: string | null;
  reinforcements_remaining: number;
  trade_count: number;
};

type TradeCard = {
  territory_id: number | null;
  symbol: CardSymbol | null;
  is_wild: boolean;
};

type ReinforcementInput = {
  territoryId: number;
  troops: number;
};

const MANDATORY_TRADE_HAND_SIZE = 5;

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
    await client.query<TroopRoom>(
      `SELECT id,status,phase,current_player_id,
              reinforcements_remaining,trade_count
       FROM game_rooms
       WHERE id=$1`,
      [roomId],
    )
  ).rows[0];

  if (!room) throw new RoomError("Partida não encontrada.", 404);
  return room;
}

async function handCardCount(
  client: PoolClient,
  roomId: string,
  playerId: string,
) {
  const row = (
    await client.query<{ count: number }>(
      `SELECT COUNT(*)::int count
       FROM game_cards
       WHERE room_id=$1 AND owner_player_id=$2 AND zone='hand'`,
      [roomId, playerId],
    )
  ).rows[0];

  return row?.count ?? 0;
}

function assertReinforcementTurn(room: TroopRoom, player: CommandPlayer) {
  if (
    room.status !== "playing" ||
    room.phase !== "reinforcement" ||
    room.current_player_id !== player.id
  ) {
    throw new RoomError("Esta ação não está disponível neste momento.", 409, {
      roomStatus: room.status,
      roomPhase: room.phase,
      expectedPhase: "reinforcement",
      currentPlayerId: room.current_player_id,
      requestPlayerId: player.id,
    });
  }
}

export async function executeReinforcement(
  client: PoolClient,
  roomId: string,
  player: CommandPlayer,
  input: ReinforcementInput,
): Promise<GameCommandPatch> {
  const room = await loadRoom(client, roomId);
  assertReinforcementTurn(room, player);

  if (
    (await handCardCount(client, room.id, player.id)) >=
    MANDATORY_TRADE_HAND_SIZE
  ) {
    throw new RoomError(
      "Troca de cartas obrigatória antes de posicionar reforços.",
      409,
    );
  }

  if (input.troops > room.reinforcements_remaining) {
    throw new RoomError("Você não possui reforços suficientes.", 409);
  }

  const own = await client.query(
    `SELECT 1
     FROM game_territories
     WHERE room_id=$1 AND territory_id=$2 AND owner_player_id=$3
     FOR UPDATE`,
    [room.id, input.territoryId, player.id],
  );

  if (!own.rowCount) {
    throw new RoomError("Você só pode reforçar territórios próprios.", 409);
  }

  const remaining = room.reinforcements_remaining - input.troops;
  const territory = (
    await client.query<{ troops: number }>(
      `UPDATE game_territories
       SET troops=troops+$3
       WHERE room_id=$1 AND territory_id=$2
       RETURNING troops`,
      [room.id, input.territoryId, input.troops],
    )
  ).rows[0];

  await client.query(
    `UPDATE game_rooms
     SET reinforcements_remaining=$2,
         phase=CASE WHEN $2=0 THEN 'attack' ELSE phase END
     WHERE id=$1`,
    [room.id, remaining],
  );

  const won = await objectiveWon(
    client,
    room.id,
    player.id,
    "troops_changed",
  );

  return {
    room: won
      ? {
          status: "finished",
          phase: "finished",
          reinforcementsRemaining: remaining,
          winnerPlayerId: player.id,
        }
      : {
          phase: remaining === 0 ? "attack" : "reinforcement",
          reinforcementsRemaining: remaining,
        },
    territories: [
      {
        territoryId: input.territoryId,
        troops: territory.troops,
      },
    ],
  };
}

export async function executeTradeCards(
  client: PoolClient,
  roomId: string,
  player: CommandPlayer,
  ids: string[],
) {
  const room = await loadRoom(client, roomId);

  if (
    room.status !== "playing" ||
    room.current_player_id !== player.id ||
    !["cards", "reinforcement"].includes(room.phase)
  ) {
    throw new RoomError("A troca não está disponível neste momento.", 409);
  }

  const cards = await client.query<TradeCard>(
    `SELECT territory_id,symbol,is_wild
     FROM game_cards
     WHERE room_id=$1
       AND owner_player_id=$2
       AND zone='hand'
       AND id=ANY($3::bigint[])
     FOR UPDATE`,
    [room.id, player.id, ids],
  );

  if (cards.rowCount !== 3) {
    throw new RoomError("Uma das cartas selecionadas não está na sua mão.", 409);
  }

  const symbols = cards.rows.map((card) =>
    card.is_wild ? "wild" : card.symbol!,
  ) as Array<CardSymbol | "wild">;

  if (!isValidTrade(symbols)) {
    throw new RoomError("Esta combinação de cartas não é válida.", 422);
  }

  const owned = new Set(
    (
      await client.query<{ territory_id: number }>(
        `SELECT territory_id
         FROM game_territories
         WHERE room_id=$1 AND owner_player_id=$2`,
        [room.id, player.id],
      )
    ).rows.map((row) => row.territory_id),
  );

  await client.query(
    `UPDATE game_cards
     SET zone='discard',owner_player_id=NULL,deck_order=NULL
     WHERE id=ANY($1::bigint[])`,
    [ids],
  );

  let changedTroops = false;
  for (const card of cards.rows) {
    if (card.territory_id && owned.has(card.territory_id)) {
      changedTroops = true;
      await client.query(
        `UPDATE game_territories
         SET troops=troops+2
         WHERE room_id=$1 AND territory_id=$2`,
        [room.id, card.territory_id],
      );
    }
  }

  await client.query(
    `UPDATE game_rooms
     SET reinforcements_remaining=reinforcements_remaining+$2,
         trade_count=trade_count+1
     WHERE id=$1`,
    [room.id, tradeValue(room.trade_count)],
  );

  if (changedTroops) {
    await objectiveWon(client, room.id, player.id, "troops_changed");
  }
  return null;
}

export async function reinforceCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
) {
  const roomId = normalizeRoomId(value);
  const territoryId = positiveInteger(
    input.territoryId,
    "Território inválido.",
  );
  const troops = positiveInteger(input.troops, "Quantidade de tropas inválida.");

  return gameCommand<GameCommandPatch>(roomId, async (client) => {
    const player = await resolveCommandPlayerBySession(client, roomId, session);
    return executeReinforcement(client, roomId, player, { territoryId, troops });
  });
}

export async function tradeCardsCommand(
  value: string,
  session: string,
  input: Record<string, unknown>,
) {
  const roomId = normalizeRoomId(value);
  const ids = Array.isArray(input.cardIds)
    ? input.cardIds.filter((card): card is string => typeof card === "string")
    : [];

  if (ids.length !== 3 || new Set(ids).size !== 3) {
    throw new RoomError("Selecione exatamente três cartas diferentes.", 422);
  }

  return gameCommand(roomId, async (client) => {
    const player = await resolveCommandPlayerBySession(client, roomId, session);
    return executeTradeCards(client, roomId, player, ids);
  });
}
