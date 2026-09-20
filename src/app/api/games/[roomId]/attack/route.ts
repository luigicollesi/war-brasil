import { NextRequest } from "next/server";
import {
  noStoreJson,
  readJsonObject,
  roomErrorResponse,
} from "@/src/lib/api-response";
import { attackPatchCommand as attackCommand } from "@/src/lib/server/game-combat-patch-command-service";
import { readGameCommandRequestMetadata } from "@/src/lib/server/game-command-request";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";
import { assertAuthenticatedPlayerSeat } from "@/server/auth/player-seat-guard";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  let roomId: string | undefined;
  let body: Record<string, unknown> | undefined;

  try {
    const session = getPlayerSession(request);
    if (!session) {
      throw new RoomError("Entre em uma sala antes de jogar.", 401);
    }

    ({ roomId } = await params);
    await assertAuthenticatedPlayerSeat(request, session, { roomId });
    const metadata = readGameCommandRequestMetadata(request);
    body = await readJsonObject(request);
    const result = await attackCommand(roomId, session, body, metadata);

    return noStoreJson(
      {
        ...result.value,
        revision: result.revision,
        baseRevision: result.baseRevision,
        ...(result.patch ? { patch: result.patch } : {}),
        ...(result.privatePatch ? { privatePatch: result.privatePatch } : {}),
      },
      {
        headers: {
          [GAME_REVISION_HEADER]: String(result.revision),
        },
      },
    );
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "attack",
      route: request.nextUrl.pathname,
      resource: { roomId },
      input: body,
    });
  }
}
