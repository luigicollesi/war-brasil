import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { getPlayerSession } from "@/src/lib/player-session";
import { addBotToRoom, RoomError } from "@/src/lib/rooms";
import { assertAuthenticatedPlayerSeat } from "@/server/auth/player-seat-guard";
import { publishLobbyChangeByCode } from "@/src/lib/server/realtime/lobby-realtime-publisher";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  let code: string | undefined;

  try {
    const session = getPlayerSession(request);
    if (!session) {
      throw new RoomError("Entre em uma sala antes de adicionar um bot.", 401);
    }

    ({ code } = await params);
    await assertAuthenticatedPlayerSeat(request, session, { roomCode: code });
    const bot = await addBotToRoom(code, session);
    await publishLobbyChangeByCode(code);
    return noStoreJson({ botId: bot.id }, { status: 201 });
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "add_lobby_bot",
      route: request.nextUrl.pathname,
      resource: { code },
    });
  }
}
