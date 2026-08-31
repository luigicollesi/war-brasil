import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { getPlayerSession } from "@/src/lib/player-session";
import { removeBotFromRoom, RoomError } from "@/src/lib/rooms";

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
    await removeBotFromRoom(code, botId, session);
    return noStoreJson({ removed: true });
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "remove_lobby_bot",
      route: request.nextUrl.pathname,
      resource: { code, botId },
    });
  }
}
