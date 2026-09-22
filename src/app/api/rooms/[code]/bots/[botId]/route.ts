import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { getPlayerSession } from "@/src/lib/player-session";
import { removeBotFromRoom, RoomError } from "@/src/lib/rooms";
import { assertAuthenticatedPlayerSeat } from "@/server/auth/player-seat-guard";
import { publishLobbyChangeByCode } from "@/src/lib/server/realtime/lobby-realtime-publisher";

type RouteContext = {
  params: Promise<{ code: string; botId: string }>;
};

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  let code: string | undefined;
  let botId: string | undefined;

  try {
    const session = getPlayerSession(request);
    if (!session) {
      throw new RoomError("Entre em uma sala antes de remover um bot.", 401);
    }

    ({ code, botId } = await params);
    await assertAuthenticatedPlayerSeat(request, session, { roomCode: code });
    await removeBotFromRoom(code, botId, session);
    await publishLobbyChangeByCode(code);
    return noStoreJson({ removed: true });
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "remove_lobby_bot",
      route: request.nextUrl.pathname,
      resource: { code, botId },
    });
  }
}
