import { NextRequest } from "next/server";
import {
  noStoreJson,
  readJsonObject,
  roomErrorResponse,
} from "@/src/lib/api-response";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";
import { readGameCommandRequestMetadata } from "@/src/lib/server/game-command-request";
import { playerTradeCommand } from "@/src/lib/server/game-player-trade-service";

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

    const metadata = readGameCommandRequestMetadata(request);
    ({ roomId } = await params);
    body = await readJsonObject(request);
    const result = await playerTradeCommand(roomId, session, body, metadata);

    return noStoreJson(
      { revision: result.revision, result: result.value },
      {
        headers: {
          [GAME_REVISION_HEADER]: String(result.revision),
        },
      },
    );
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "player_trade",
      route: request.nextUrl.pathname,
      resource: { roomId },
      input: body,
    });
  }
}
