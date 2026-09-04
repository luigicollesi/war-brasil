import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { voteRematchCommand } from "@/src/lib/game-finish-command-service";
import { readGameCommandRequestMetadata } from "@/src/lib/server/game-command-request";
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
      throw new RoomError("Entre em uma sala antes de votar na revanche.", 401);
    }

    const metadata = readGameCommandRequestMetadata(request);
    ({ roomId } = await params);
    const result = await voteRematchCommand(roomId, session, metadata);

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
      operation: "vote_rematch",
      route: request.nextUrl.pathname,
      resource: { roomId },
    });
  }
}
