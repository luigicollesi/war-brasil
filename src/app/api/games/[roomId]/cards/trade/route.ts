import { NextRequest } from "next/server";
import {
  noStoreJson,
  readJsonObject,
  roomErrorResponse,
} from "@/src/lib/api-response";
import { tradeCardsPatchCommand as tradeCardsCommand } from "@/src/lib/server/game-card-redemption-patch-command-service";
import { readGameCommandRequestMetadata } from "@/src/lib/server/game-command-request";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
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

    const metadata = readGameCommandRequestMetadata(request);
    ({ roomId } = await params);
    body = await readJsonObject(request);
    const result = await tradeCardsCommand(roomId, session, body, metadata);

    return noStoreJson(
      {
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
      operation: "trade_cards",
      route: request.nextUrl.pathname,
      resource: { roomId },
      input: body,
    });
  }
}
