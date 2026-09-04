import "server-only";

import {
  GAME_COMMAND_ID_HEADER,
  GAME_EXPECTED_REVISION_HEADER,
  isGameCommandId,
  parseGameExpectedRevision,
  type GameCommandRequestMetadata,
} from "@/src/lib/game-command-request";
import { RoomError } from "@/src/lib/rooms";

export function readGameCommandRequestMetadata(
  request: Pick<Request, "headers">,
): GameCommandRequestMetadata | null {
  const commandId = request.headers.get(GAME_COMMAND_ID_HEADER);
  const rawExpectedRevision = request.headers.get(GAME_EXPECTED_REVISION_HEADER);

  if (commandId === null && rawExpectedRevision === null) return null;

  const expectedRevision = parseGameExpectedRevision(rawExpectedRevision);
  if (!isGameCommandId(commandId) || expectedRevision === null) {
    throw new RoomError("Metadados do comando inválidos.", 400);
  }

  return { commandId, expectedRevision };
}
