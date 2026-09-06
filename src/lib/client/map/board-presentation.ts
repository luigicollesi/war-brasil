import {
  INITIAL_TERRITORY_HIGHLIGHT_DURATION_MS,
  INITIAL_TERRITORY_HIGHLIGHT_STEP_MS,
  INITIAL_TERRITORY_REVEAL_STEP_MS,
} from "@/src/lib/game-transitions";

export type BoardPresentationState =
  | { mode: "normal" }
  | {
      mode: "initial-territory-draw";
      revealedTerritoryIds: ReadonlySet<number>;
      highlightPlayerId: string | null;
      highlightOn: boolean;
      titleVisible: boolean;
    };

export const NORMAL_BOARD_PRESENTATION: BoardPresentationState = {
  mode: "normal",
};

type InitialTerritoryPresentationInput = {
  territoryIds: readonly number[];
  startedAt: string;
  nowMs: number;
  highlightPlayerId: string | null;
};

function startedAtMs(startedAt: string) {
  const parsed = Date.parse(startedAt);
  return Number.isFinite(parsed) ? parsed : null;
}

export function deriveInitialTerritoryBoardPresentation({
  territoryIds,
  startedAt,
  nowMs,
  highlightPlayerId,
}: InitialTerritoryPresentationInput): BoardPresentationState {
  const start = startedAtMs(startedAt);
  if (start === null) return NORMAL_BOARD_PRESENTATION;

  const titleVisible = nowMs < start;
  const elapsedMs = Math.max(0, nowMs - start);
  const revealDurationMs = territoryIds.length * INITIAL_TERRITORY_REVEAL_STEP_MS;
  const revealedCount = Math.min(
    territoryIds.length,
    Math.floor(elapsedMs / INITIAL_TERRITORY_REVEAL_STEP_MS),
  );
  const highlightElapsedMs = elapsedMs - revealDurationMs;
  const highlightOn =
    highlightElapsedMs >= 0 &&
    highlightElapsedMs < INITIAL_TERRITORY_HIGHLIGHT_DURATION_MS &&
    Math.floor(highlightElapsedMs / INITIAL_TERRITORY_HIGHLIGHT_STEP_MS) % 2 === 0;

  return {
    mode: "initial-territory-draw",
    revealedTerritoryIds: new Set(territoryIds.slice(0, revealedCount)),
    highlightPlayerId,
    highlightOn,
    titleVisible,
  };
}

export function nextInitialTerritoryPresentationWakeAt({
  territoryIds,
  startedAt,
  nowMs,
}: Omit<InitialTerritoryPresentationInput, "highlightPlayerId">): number | null {
  const start = startedAtMs(startedAt);
  if (start === null) return null;
  if (nowMs < start) return start;

  const elapsedMs = nowMs - start;
  const revealDurationMs = territoryIds.length * INITIAL_TERRITORY_REVEAL_STEP_MS;

  if (elapsedMs < revealDurationMs) {
    const nextRevealIndex =
      Math.floor(elapsedMs / INITIAL_TERRITORY_REVEAL_STEP_MS) + 1;
    return start + nextRevealIndex * INITIAL_TERRITORY_REVEAL_STEP_MS;
  }

  const highlightElapsedMs = elapsedMs - revealDurationMs;
  if (highlightElapsedMs < INITIAL_TERRITORY_HIGHLIGHT_DURATION_MS) {
    const nextHighlightIndex =
      Math.floor(highlightElapsedMs / INITIAL_TERRITORY_HIGHLIGHT_STEP_MS) + 1;
    return start + revealDurationMs + nextHighlightIndex * INITIAL_TERRITORY_HIGHLIGHT_STEP_MS;
  }

  return null;
}
