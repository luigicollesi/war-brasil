import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { getPlayerSession } from "@/src/lib/player-session";
import { heartbeatWaitingRoom, RoomError } from "@/src/lib/rooms";
import { assertAuthenticatedPlayerSeat } from "@/server/auth/player-seat-guard";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  let code: string | undefined;
  try {
    const session = getPlayerSession(request);
    if (!session) {
      throw new RoomError("Entre em uma sala antes de renovar sua presença.", 401);
    }

    ({ code } = await params);
    await assertAuthenticatedPlayerSeat(request, session, { roomCode: code });
    const result = await heartbeatWaitingRoom(code, session);
    return noStoreJson(result);
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "heartbeat_waiting_room",
      route: request.nextUrl.pathname,
      resource: { code },
    });
  }
}
