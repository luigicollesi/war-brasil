export const GAME_COMMAND_ID_HEADER = "x-game-command-id";
export const GAME_EXPECTED_REVISION_HEADER = "x-game-expected-revision";

export type GameCommandRequestMetadata = {
  commandId: string;
  expectedRevision: number;
};

const COMMAND_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isGameCommandId(value: unknown): value is string {
  return typeof value === "string" && COMMAND_ID_PATTERN.test(value);
}

export function parseGameExpectedRevision(value: unknown) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 1 ? value : null;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}
