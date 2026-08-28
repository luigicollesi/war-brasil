import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { returnEveryoneToLobbyCommand } from "@/src/lib/game-finish-command-service";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  let roomId: string | undefined;

  try {
    const session = getPlayerSession(request);
    if (!session) {
      throw new RoomError("Entre em uma sala antes de voltar ao lobby.", 401);
    }

    ({ roomId } = await params);
    const result = await returnEveryoneToLobbyCommand(roomId, session);

    return noStoreJson(
      {
        ...result.value,
        baseRevision: result.baseRevision,
      },
      {
        headers: {
          [GAME_REVISION_HEADER]: String(result.revision),
        },
      },
    );
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "return_everyone_to_lobby",
      route: request.nextUrl.pathname,
      resource: { roomId },
    });
  }
}
