import type { GamePhase } from "./game-contract";
import type { MapTargetHint } from "./game-interaction";

export type MapFocusArrow = {
  fromTerritoryId: number;
  toTerritoryId: number;
} | null;

function sortedUniqueTerritoryIds(ids: readonly number[]) {
  return [...new Set(ids.filter(Number.isInteger))].sort((a, b) => a - b);
}

export function deriveMapFocusTerritoryIds({
  phase,
  selectedTerritoryId,
  targetHints,
  arrow,
}: {
  phase: GamePhase;
  selectedTerritoryId: number | null | undefined;
  targetHints: readonly MapTargetHint[];
  arrow: MapFocusArrow;
}) {
  if (arrow) {
    return sortedUniqueTerritoryIds([
      arrow.fromTerritoryId,
      arrow.toTerritoryId,
    ]);
  }

  if (selectedTerritoryId == null) return [];

  const targetIds = targetHints.map((target) => target.territoryId);

  if (phase === "maneuver") {
    return targetIds.length
      ? sortedUniqueTerritoryIds(targetIds)
      : [selectedTerritoryId];
  }

  if (phase === "attack") {
    return sortedUniqueTerritoryIds([selectedTerritoryId, ...targetIds]);
  }

  return [selectedTerritoryId];
}
