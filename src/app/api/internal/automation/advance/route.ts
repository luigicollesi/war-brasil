import { NextRequest } from "next/server";
import {
  noStoreJson,
  readJsonObject,
  roomErrorResponse,
} from "@/src/lib/api-response";
import { advanceGameAutomationCommand } from "@/src/lib/game-automation-service";
import { assertGameAutomationWorkerRequest } from "@/src/lib/server/automation/game-automation-worker-auth";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
import { RoomError } from "@/src/lib/rooms";

function parseRoomId(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new RoomError("Partida inválida para automação.", 422);
  }
  return value;
}

function parseExpectedRevision(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new RoomError("Revisão esperada inválida.", 422);
  }
  return value;
}

export async function POST(request: NextRequest) {
  let roomId: string | undefined;
  let body: Record<string, unknown> | undefined;

  try {
    assertGameAutomationWorkerRequest(request);
    body = await readJsonObject(request);
    roomId = parseRoomId(body.roomId);
    const expectedRevision = parseExpectedRevision(body.expectedRevision);

    const result = await advanceGameAutomationCommand(
      roomId,
      expectedRevision,
    );

    return noStoreJson(
      {
        changed: result.changed,
        revision: result.revision,
        kind: result.value?.kind ?? null,
      },
      {
        headers: {
          [GAME_REVISION_HEADER]: String(result.revision),
        },
      },
    );
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "internal_advance_game_automation",
      route: request.nextUrl.pathname,
      resource: { roomId },
      input: body,
    });
  }
}
