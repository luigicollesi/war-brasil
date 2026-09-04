import type { AttackMode } from "./game-barrier-rules";
import type { CardSymbol } from "./game-config";
import type { TradeCardDescriptor } from "./game-trade-rules";
import type {
  AppliedEventTroopChange,
  ResolvedEventEffect,
} from "./events/event-types";
import type { PlayerColor } from "./lobby";
import type { TerritoryConnection } from "./territory-connections";

export type GameStatus = "waiting" | "order_roll" | "playing" | "finished";

export type GamePhase =
  | "trade"
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
  attackMode?: AttackMode;
  barrierName?: string | null;
  attackerTroopsAfter?: number;
  defenderTroopsAfter?: number;
};

export type GamePlayer = {
  id: string;
  factionName: string;
  color: PlayerColor;
  turnPosition: number | null;
  isMe: boolean;
  isBot: boolean;
  rolls: Array<{ round: number; value: number; rolledAt: string }>;
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

export type GameTradeTerms = {
  offered: TradeCardDescriptor;
  requested: TradeCardDescriptor;
};

export type GameTradeOffer = {
  id: string;
  proposerPlayerId: string;
  targetPlayerId: string;
  status: "open" | "countered" | "accepted_pending_selection";
  original: GameTradeTerms;
  counter: {
    proposerPlayerId: string;
    terms: GameTradeTerms;
  } | null;
};

export type GameTradeState = {
  offersUsed: number;
  offerLimit: number;
  signalsUsed: number;
  signalLimit: number;
  activeOffer: GameTradeOffer | null;
  myPendingSelection: {
    offerId: string;
    descriptor: TradeCardDescriptor;
  } | null;
};

export type ActiveGameEvent = {
  eventId: number;
  name: string;
  description: string;
  resolvedEffects: ResolvedEventEffect[];
  appliedTroopChanges: AppliedEventTroopChange[];
};

export type GameRematchState = {
  voteCount: number;
  requiredCount: number;
  hasVoted: boolean;
};

export type GamePresentation = {
  kind: "initial_territory_draw";
  startedAt: string;
  territoryIds: number[];
};

export type GameSnapshot = {
  room: {
    id: string;
    code: string;
    status: GameStatus;
    orderRollRound: number;
    orderRollPlayerId: string | null;
    lastOrderRollPlayerId: string | null;
    presentation: GamePresentation | null;
    phase: GamePhase;
    currentPlayerId: string | null;
    turnNumber: number;
    roundNumber: number;
    jurassicTunnelDestinationId: number | null;
    activeEvent: ActiveGameEvent | null;
    reinforcementsRemaining: number;
    winnerPlayerId: string | null;
    automaticAdvancePending: boolean;
    rematch: GameRematchState | null;
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
  trade: GameTradeState | null;
  myObjective: {
    id: string;
    name: string;
    description: string;
    targetFactionName: string | null;
  } | null;
};
