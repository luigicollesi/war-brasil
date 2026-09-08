import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { INITIAL_TERRITORY_SYNC_DELAY_MS } from "@/src/lib/game-transitions";
import {
  assignObjectives,
  ObjectiveConfigurationError,
} from "@/src/lib/objectives/objective-assignment-service";
import { initializeDiceBalanceForGame } from "@/src/lib/server/game-dice-balance-service";
import { RoomError } from "@/src/lib/server/room-error";

const MINIMUM_PLAYERS_TO_START = 2;
const TERRITORY_COUNT = 42;
const DECK_SIZE = 44;
const WILD_CARD_COUNT = 2;

type StartPlayer = {
  id: string;
};

function shuffledRange(length: number) {
  const values = Array.from({ length }, (_, index) => index + 1);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

async function loadPlayers(client: PoolClient, roomId: string) {
  const players = (
    await client.query<StartPlayer>(
      "SELECT id FROM game.players WHERE room_id=$1 ORDER BY joined_at,id",
      [roomId],
    )
  ).rows;

  if (players.length < MINIMUM_PLAYERS_TO_START) {
    throw new RoomError("São necessários ao menos dois jogadores.", 409);
  }
  return players;
}

async function createInitialTerritories(
  client: PoolClient,
  roomId: string,
  players: StartPlayer[],
) {
  const territoryIds = shuffledRange(TERRITORY_COUNT);
  const values: string[] = [];
  const parameters: Array<string | number> = [];

  for (const [index, territoryId] of territoryIds.entries()) {
    const offset = parameters.length;
    values.push(
      `($${offset + 1},$${offset + 2},$${offset + 3},1,$${offset + 4})`,
    );
    parameters.push(
      roomId,
      territoryId,
      players[index % players.length].id,
      index + 1,
    );
  }

  await client.query(
    `INSERT INTO game.territories (
       room_id,territory_id,owner_player_id,troops,initial_draw_order
     )
     VALUES ${values.join(",")}`,
    parameters,
  );
}

async function createObjectives(
  client: PoolClient,
  roomId: string,
  players: StartPlayer[],
) {
  try {
    await assignObjectives(client, roomId, players);
  } catch (error) {
    if (error instanceof ObjectiveConfigurationError) {
      throw new RoomError(error.message, 503);
    }
    throw error;
  }
}

async function createDeck(client: PoolClient, roomId: string) {
  const deckOrders = shuffledRange(DECK_SIZE);
  const symbols = await client.query<{ territory_id: number; symbol: string }>(
    "SELECT territory_id,symbol FROM catalog.territory_card_symbols ORDER BY territory_id",
  );

  if (symbols.rows.length !== TERRITORY_COUNT) {
    throw new RoomError("Os símbolos das cartas de território estão incompletos.", 503);
  }

  for (const [index, card] of symbols.rows.entries()) {
    await client.query(
      `INSERT INTO game.cards (room_id,territory_id,symbol,deck_order)
       VALUES ($1,$2,$3,$4)`,
      [roomId, card.territory_id, card.symbol, deckOrders[index]],
    );
  }

  for (let index = 0; index < WILD_CARD_COUNT; index += 1) {
    await client.query(
      `INSERT INTO game.cards (room_id,is_wild,deck_order)
       VALUES ($1,TRUE,$2)`,
      [roomId, deckOrders[TERRITORY_COUNT + index]],
    );
  }
}

async function transitionRoomToOrderRoll(client: PoolClient, roomId: string) {
  const result = await client.query(
    `UPDATE game.rooms
     SET status='order_roll',order_roll_round=1,started_at=NULL,
         initial_territory_presentation_started_at=
           NOW() + ($2::int * INTERVAL '1 millisecond'),
         phase='cards',current_player_id=NULL,turn_number=1,round_number=1,
         jurassic_tunnel_territory_id=NULL,reinforcements_remaining=0,
         conquered_this_turn=FALSE,trade_count=0,trade_offers_used=0,
         winner_player_id=NULL,pending_from_territory_id=NULL,
         pending_to_territory_id=NULL,last_battle=NULL
     WHERE id=$1 AND status='waiting'`,
    [roomId, INITIAL_TERRITORY_SYNC_DELAY_MS],
  );

  if ((result.rowCount ?? 0) !== 1) {
    throw new RoomError("A partida não está disponível para iniciar.", 409);
  }
}

export async function startGame(client: PoolClient, roomId: string) {
  const players = await loadPlayers(client, roomId);

  // Match creation and all runtime artifacts are part of the caller transaction.
  // Any failure after this point rolls the complete start back.
  await initializeDiceBalanceForGame(client, roomId);
  await createInitialTerritories(client, roomId, players);
  await createObjectives(client, roomId, players);
  await createDeck(client, roomId);
  await transitionRoomToOrderRoll(client, roomId);
}
