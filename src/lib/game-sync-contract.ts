export const GAME_REVISION_HEADER = "x-game-revision";

export function parseGameRevision(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;

  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 1 ? revision : null;
}
