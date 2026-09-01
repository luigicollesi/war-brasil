import type { CardSymbol, Region } from "../game-config";
import type { TerritoryConnection } from "../territory-connections";
import type { ResolvedEventEffect } from "../events/event-types";

export type BotStrategicPlayer = {
  id: string;
  turnPosition: number | null;
  isBot: boolean;
};

export type BotStrategicTerritory = {
  territoryId: number;
  ownerPlayerId: string;
  troops: number;
  movedInTurn: number;
};

export type BotStrategicCard = {
  id: string;
  territoryId: number | null;
  symbol: CardSymbol | null;
  isWild: boolean;
};

export type BotObjectiveSnapshot = {
  type: string;
  params: Record<string, unknown>;
  targetPlayerId: string | null;
};

export type BotStrategicState = {
  room: {
    id: string;
    phase: string;
    roundNumber: number;
    reinforcementsRemaining: number;
    conqueredThisTurn: boolean;
  };
  bot: {
    id: string;
    cardTradeCount: number;
  };
  objective: BotObjectiveSnapshot;
  cards: BotStrategicCard[];
  players: BotStrategicPlayer[];
  territories: BotStrategicTerritory[];
  topology: {
    connections: TerritoryConnection[];
    eventId: number;
    resolvedEventEffects: ResolvedEventEffect[];
  };
};

export type BotRegionTerritories = Record<Region, number[]>;
