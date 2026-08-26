import type { CardSymbol } from "@/src/lib/game-config";
import type { PlayerColor } from "@/src/lib/lobby";
import type { TerritoryConnection } from "@/src/lib/territory-connections";

export type GameStatus = "order_roll" | "playing" | "finished";

export type GamePhase =
  | "cards"
  | "reinforcement"
  | "attack"
  | "maneuver"
  | "end_turn"
  | "finished";

export type BattleStage =
  | "awaiting_attacker_roll"
  | "show_attacker_result"
  | "awaiting_defender_roll"
  | "show_defender_result"
  | "show_comparison"
  | "show_battle_result";

export type GameBattle = {
  attacker: number[];
  defender: number[];
  attackerLosses: number;
  defenderLosses: number;
  conquered: boolean;
  attackerTerritoryId: number;
  defenderTerritoryId: number;
  attackerPlayerId: string;
  defenderPlayerId: string;
  stage: BattleStage;
  stageStartedAt: string;
  attackerTroopsAfter?: number;
  defenderTroopsAfter?: number;
};

export type GamePlayer = {
  id: string;
  factionName: string;
  color: PlayerColor;
  turnPosition: number | null;
  isMe: boolean;
  rolls: Array<{ round: number; value: number }>;
};

export type GameTerritory = {
  territoryId: number;
  ownerPlayerId: string;
  ownerColor: PlayerColor;
  troops: number;
  movedInTurn: number;
};

export type GameCard = {
  id: string;
  territoryId: number | null;
  symbol: CardSymbol | "wild";
};

export type GameSnapshot = {
  room: {
    id: string;
    code: string;
    status: GameStatus;
    orderRollRound: number;
    orderRollPlayerId: string | null;
    lastOrderRollPlayerId: string | null;
    phase: GamePhase;
    currentPlayerId: string | null;
    turnNumber: number;
    roundNumber: number;
    jurassicTunnelDestinationId: number | null;
    reinforcementsRemaining: number;
    winnerPlayerId: string | null;
    pendingConquest: {
      fromTerritoryId: number;
      toTerritoryId: number;
    } | null;
    battle: GameBattle | null;
  };
  players: GamePlayer[];
  territories: GameTerritory[];
  eligiblePlayerIds: string[];
  connections: TerritoryConnection[];
  myCards: GameCard[];
  myObjective: {
    id: string;
    name: string;
    description: string;
    targetFactionName: string | null;
  } | null;
};
