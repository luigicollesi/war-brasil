export const ORDER_ROLL_PRESENTATION_MS = 2_000;
export const BATTLE_PRESENTATION_MS = 2_000;

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

export function nextBattlePresentationTransition(
  stage: BattleStage,
  stageStartedAt: string | Date,
  nowMs = Date.now(),
): BattlePresentationTransition | null {
  if (!elapsedAtLeast(stageStartedAt, BATTLE_PRESENTATION_MS, nowMs)) {
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
