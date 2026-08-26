import { NextRequest } from "next/server";
import {
  noStoreJson,
  readJsonObject,
  roomErrorResponse,
} from "@/src/lib/api-response";
import { advanceGamePresentationCommand } from "@/src/lib/game-presentation-service";
import { gameQuery } from "@/src/lib/game-query";
import { readPlayerGameRevision } from "@/src/lib/game-revision";
import {
  GAME_REVISION_HEADER,
  parseGameRevision,
} from "@/src/lib/game-sync-contract";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";

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
    if (!/^\d+$/.test(roomId)) {
      throw new RoomError("Partida não encontrada.", 404);
    }

    body = await readJsonObject(request);
    const expectedRevision = parseGameRevision(
      typeof body.expectedRevision === "number"
        ? String(body.expectedRevision)
        : null,
    );

    if (expectedRevision === null) {
      throw new RoomError("Revisão esperada inválida.", 422);
    }

    const currentRevision = await gameQuery((client) =>
      readPlayerGameRevision(client, roomId!, session),
    );

    if (currentRevision !== expectedRevision) {
      return noStoreJson(
        { changed: false, revision: currentRevision },
        {
          headers: {
            [GAME_REVISION_HEADER]: String(currentRevision),
          },
        },
      );
    }

    const result = await advanceGamePresentationCommand(
      roomId,
      expectedRevision,
    );

    return noStoreJson(
      { changed: result.changed, revision: result.revision },
      {
        headers: {
          [GAME_REVISION_HEADER]: String(result.revision),
        },
      },
    );
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "advance_game_presentation",
      route: request.nextUrl.pathname,
      resource: { roomId },
      input: body,
    });
  }
}
