export const INITIAL_TERRITORY_SYNC_DELAY_MS = 2_000;
export const INITIAL_TERRITORY_REVEAL_STEP_MS = 100;
export const INITIAL_TERRITORY_REVEAL_COUNT = 42;
export const INITIAL_TERRITORY_HIGHLIGHT_STEP_MS = 500;
export const INITIAL_TERRITORY_HIGHLIGHT_DURATION_MS = 2_000;
export const INITIAL_TERRITORY_REVEAL_DURATION_MS =
  INITIAL_TERRITORY_REVEAL_STEP_MS * INITIAL_TERRITORY_REVEAL_COUNT;
export const INITIAL_TERRITORY_PRESENTATION_MS =
  INITIAL_TERRITORY_REVEAL_DURATION_MS +
  INITIAL_TERRITORY_HIGHLIGHT_DURATION_MS;
export const ORDER_ROLL_PRESENTATION_MS = 2_000;
export const BATTLE_DICE_PRESENTATION_MS = 3_000;
export const BATTLE_COMPARISON_PRESENTATION_MS = 2_000;
export const BATTLE_RESULT_PRESENTATION_MS = 2_000;

export type BattleStage =
  | "awaiting_attacker_roll"
  | "show_attacker_result"
  | "awaiting_defender_roll"
  | "show_defender_result"
  | "show_comparison"
  | "show_battle_result";

type BattlePresentationTransition =
  | "await_defender_roll"
  | "show_comparison"
  | "resolve_battle"
  | "clear_battle";

function elapsedAtLeast(
  startedAt: string | Date,
  durationMs: number,
  nowMs: number,
) {
  const startedAtMs =
    startedAt instanceof Date ? startedAt.getTime() : Date.parse(startedAt);

  return isFinite(startedAtMs) && nowMs - startedAtMs >= durationMs;
}

export function isInitialTerritoryPresentationDue(
  startedAt: string | Date,
  nowMs = Date.now(),
) {
  return elapsedAtLeast(startedAt, INITIAL_TERRITORY_PRESENTATION_MS, nowMs);
}

function battleStagePresentationDuration(stage: BattleStage) {
  if (stage === "show_attacker_result" || stage === "show_defender_result") {
    return BATTLE_DICE_PRESENTATION_MS;
  }
  if (stage === "show_comparison") {
    return BATTLE_COMPARISON_PRESENTATION_MS;
  }
  if (stage === "show_battle_result") {
    return BATTLE_RESULT_PRESENTATION_MS;
  }
  return null;
}

export function nextBattlePresentationTransition(
  stage: BattleStage,
  stageStartedAt: string | Date,
  nowMs = Date.now(),
): BattlePresentationTransition | null {
  const durationMs = battleStagePresentationDuration(stage);
  if (durationMs === null || !elapsedAtLeast(stageStartedAt, durationMs, nowMs)) {
    return null;
  }

  if (stage === "show_attacker_result") return "await_defender_roll";
  if (stage === "show_defender_result") return "show_comparison";
  if (stage === "show_comparison") return "resolve_battle";
  if (stage === "show_battle_result") return "clear_battle";

  return null;
}

export function isOrderRollPresentationDue(
  allEligiblePlayersRolled: boolean,
  lastRollAt: Date | null,
  nowMs = Date.now(),
) {
  if (!allEligiblePlayersRolled || !lastRollAt) return false;

  return elapsedAtLeast(
    lastRollAt,
    ORDER_ROLL_PRESENTATION_MS,
    nowMs,
  );
}