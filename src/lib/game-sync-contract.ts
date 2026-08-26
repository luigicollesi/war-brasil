export const GAME_REVISION_HEADER = "x-game-revision";
export const GAME_TOPOLOGY_HEADER = "x-game-topology";

// Bump this value whenever the persisted base territory topology changes.
export const GAME_TOPOLOGY_VERSION = "1";

export function parseGameRevision(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;

  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 1 ? revision : null;
}
