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
import { publishTradeDeclineResolution } from "@/src/lib/server/game-trade-resolution-notifier";
import { getAuthenticatedSession } from "@/src/lib/server/auth/auth-guard";

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
    const accountSession = await getAuthenticatedSession(request);
    if (!accountSession) {
      throw new RoomError(
        "Autenticação necessária para acessar este assento.",
        401,
      );
    }
    const metadata = readGameCommandRequestMetadata(request);
    body = await readJsonObject(request);
    const result = await playerTradeCommand(
      roomId,
      session,
      body,
      metadata,
      accountSession.user.id,
    );

    if (body.action === "decline") {
      await publishTradeDeclineResolution(roomId, session, body.offerId).catch(
        () => false,
      );
    }

    return noStoreJson(
      {
        revision: result.revision,
        baseRevision: result.baseRevision,
        result: result.value,
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
      operation: "player_trade",
      route: request.nextUrl.pathname,
      resource: { roomId },
      input: body,
    });
  }
}
