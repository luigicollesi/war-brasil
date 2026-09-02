import "server-only";

import type { PoolClient } from "pg";
import { getEffectiveGameTopology } from "@/src/lib/game-effective-topology-service";
import { withObjectiveSchemaCompatibility } from "@/src/lib/objectives/objective-schema-compatibility";
import type {
  BotObjectiveSnapshot,
  BotStrategicCard,
  BotStrategicPlayer,
  BotStrategicState,
  BotStrategicTerritory,
} from "./bot-state";

type StateRoom = {
  id: string;
  phase: string;
  round_number: number;
  reinforcements_remaining: number;
  conquered_this_turn: boolean;
  jurassic_tunnel_territory_id: number | null;
};

type StateBot = {
  id: string;
  card_trade_count: number;
};

type ObjectiveRow = {
  type: string;
  params: Record<string, unknown>;
  target_player_id: string | null;
};

export async function loadBotStrategicState(
  client: PoolClient,
  roomId: string,
  botId: string,
): Promise<BotStrategicState> {
  const room = (
    await client.query<StateRoom>(
      `SELECT id,phase,round_number,reinforcements_remaining,
              conquered_this_turn,jurassic_tunnel_territory_id
       FROM game_rooms
       WHERE id=$1`,
      [roomId],
    )
  ).rows[0];
  if (!room) throw new Error("Partida não encontrada para estratégia do bot.");

  const bot = (
    await client.query<StateBot>(
      `SELECT id,card_trade_count
       FROM room_players
       WHERE room_id=$1 AND id=$2 AND is_bot=TRUE`,
      [roomId, botId],
    )
  ).rows[0];
  if (!bot) throw new Error("Bot não encontrado na partida.");

  const objective = await withObjectiveSchemaCompatibility(
    client,
    async () =>
      (
        await client.query<ObjectiveRow>(
          `SELECT o.type,
                  COALESCE(
                    CASE WHEN r.objective_id=a.objective_id THEN a.resolved_params END,
                    o.params
                  ) params,
                  a.target_player_id
           FROM game_player_objectives a
           JOIN objectives o ON o.id=a.objective_id
           LEFT JOIN objective_rules r ON r.id=a.objective_rule_id
           WHERE a.room_id=$1 AND a.player_id=$2`,
          [roomId, botId],
        )
      ).rows[0] ?? null,
    async () =>
      (
        await client.query<ObjectiveRow>(
          `SELECT o.type,o.params,a.target_player_id
           FROM game_player_objectives a
           JOIN objectives o ON o.id=a.objective_id
           WHERE a.room_id=$1 AND a.player_id=$2`,
          [roomId, botId],
        )
      ).rows[0] ?? null,
  );
  if (!objective) throw new Error("Objetivo do bot não encontrado.");

  const players = (
    await client.query<{
      id: string;
      turn_position: number | null;
      is_bot: boolean;
    }>(
      `SELECT id,turn_position,is_bot
       FROM room_players
       WHERE room_id=$1
       ORDER BY joined_at,id`,
      [roomId],
    )
  ).rows.map<BotStrategicPlayer>((player) => ({
    id: player.id,
    turnPosition: player.turn_position,
    isBot: player.is_bot,
  }));

  const territories = (
    await client.query<{
      territory_id: number;
      owner_player_id: string;
      troops: number;
      moved_in_turn: number;
    }>(
      `SELECT territory_id,owner_player_id,troops,moved_in_turn
       FROM game_territories
       WHERE room_id=$1
       ORDER BY territory_id`,
      [roomId],
    )
  ).rows.map<BotStrategicTerritory>((territory) => ({
    territoryId: territory.territory_id,
    ownerPlayerId: territory.owner_player_id,
    troops: territory.troops,
    movedInTurn: territory.moved_in_turn,
  }));

  const cards = (
    await client.query<{
      id: string;
      territory_id: number | null;
      symbol: BotStrategicCard["symbol"];
      is_wild: boolean;
    }>(
      `SELECT id::text id,territory_id,symbol,is_wild
       FROM game_cards
       WHERE room_id=$1 AND owner_player_id=$2 AND zone='hand'
       ORDER BY id`,
      [roomId, botId],
    )
  ).rows.map<BotStrategicCard>((card) => ({
    id: card.id,
    territoryId: card.territory_id,
    symbol: card.symbol,
    isWild: card.is_wild,
  }));

  const topology = await getEffectiveGameTopology(client, {
    roomId,
    roundNumber: room.round_number,
    jurassicTunnelDestinationId: room.jurassic_tunnel_territory_id,
  });

  const objectiveSnapshot: BotObjectiveSnapshot = {
    type: objective.type,
    params: objective.params,
    targetPlayerId: objective.target_player_id,
  };

  return {
    room: {
      id: room.id,
      phase: room.phase,
      roundNumber: room.round_number,
      reinforcementsRemaining: room.reinforcements_remaining,
      conqueredThisTurn: room.conquered_this_turn,
    },
    bot: {
      id: bot.id,
      cardTradeCount: bot.card_trade_count,
    },
    objective: objectiveSnapshot,
    cards,
    players,
    territories,
    topology,
  };
}
