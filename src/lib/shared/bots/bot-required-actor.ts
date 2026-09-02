import type { GameBattle, GameStatus } from "../game-contract";

const PRESENTATION_BATTLE_STAGES = new Set<GameBattle["stage"]>([
  "show_attacker_result",
  "show_defender_result",
  "show_comparison",
  "show_battle_result",
]);

type RequiredActorState = {
  status: GameStatus;
  orderRollPlayerId: string | null;
  currentPlayerId: string | null;
  battle: GameBattle | null;
  pendingConquest: boolean;
};

type PresentationState = {
  status: GameStatus;
  orderRollPlayerId: string | null;
  eligiblePlayerCount: number;
  battle: GameBattle | null;
};

export function isBattlePresentationStage(stage: GameBattle["stage"]) {
  return PRESENTATION_BATTLE_STAGES.has(stage);
}

export function isPresentationAdvancePending(state: PresentationState) {
  if (
    state.status === "order_roll" &&
    state.orderRollPlayerId === null &&
    state.eligiblePlayerCount > 0
  ) {
    return true;
  }

  return Boolean(
    state.battle && isBattlePresentationStage(state.battle.stage),
  );
}

export function requiredActorId(state: RequiredActorState) {
  if (state.status === "order_roll") {
    return state.orderRollPlayerId;
  }

  if (state.status !== "playing") return null;

  if (state.battle) {
    if (state.battle.stage === "awaiting_attacker_roll") {
      return state.battle.attackerPlayerId;
    }
    if (state.battle.stage === "awaiting_defender_roll") {
      return state.battle.defenderPlayerId;
    }
    return null;
  }

  if (state.pendingConquest) return state.currentPlayerId;
  return state.currentPlayerId;
}
