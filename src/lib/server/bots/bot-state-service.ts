import "server-only";

import type { PoolClient } from "pg";
import { getEffectiveGameTopology } from "@/src/lib/game-effective-topology-service";
import type { GameRuleset } from "@/src/lib/game-mode";
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
  ruleset: GameRuleset;
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
      `SELECT room.id,
              COALESCE(match.ruleset_snapshot,room.ruleset,'objective') ruleset,
              room.phase,room.round_number,room.reinforcements_remaining,
              room.conquered_this_turn,room.jurassic_tunnel_territory_id
       FROM game.rooms room
       LEFT JOIN game.matches match ON match.id=room.current_match_id
       WHERE room.id=$1`,
      [roomId],
    )
  ).rows[0];
  if (!room) throw new Error("Partida não encontrada para estratégia do bot.");

  const bot = (
    await client.query<StateBot>(
      `SELECT id,card_trade_count
       FROM game.players
       WHERE room_id=$1
         AND id=$2
         AND is_bot=TRUE
         AND left_at IS NULL`,
      [roomId, botId],
    )
  ).rows[0];
  if (!bot) throw new Error("Bot não encontrado na partida.");

  const objective =
    room.ruleset === "objective"
      ? await withObjectiveSchemaCompatibility(
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
                 FROM game.player_objectives a
                 JOIN catalog.objectives o ON o.id=a.objective_id
                 LEFT JOIN catalog.objective_rules r ON r.id=a.objective_rule_id
                 WHERE a.room_id=$1 AND a.player_id=$2`,
                [roomId, botId],
              )
            ).rows[0] ?? null,
          async () =>
            (
              await client.query<ObjectiveRow>(
                `SELECT o.type,o.params,a.target_player_id
                 FROM game.player_objectives a
                 JOIN catalog.objectives o ON o.id=a.objective_id
                 WHERE a.room_id=$1 AND a.player_id=$2`,
                [roomId, botId],
              )
            ).rows[0] ?? null,
        )
      : null;

  if (room.ruleset === "objective" && !objective) {
    throw new Error("Objetivo do bot não encontrado.");
  }

  const players = (
    await client.query<{
      id: string;
      turn_position: number | null;
      is_bot: boolean;
    }>(
      `SELECT id,turn_position,is_bot
       FROM game.players
       WHERE room_id=$1
         AND left_at IS NULL
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
       FROM game.territories
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
       FROM game.cards
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

  const objectiveSnapshot: BotObjectiveSnapshot | null = objective
    ? {
        type: objective.type,
        params: objective.params,
        targetPlayerId: objective.target_player_id,
      }
    : null;

  return {
    room: {
      id: room.id,
      ruleset: room.ruleset,
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
