import { NextRequest } from "next/server";
import {
  noStoreJson,
  readJsonObject,
  roomErrorResponse,
} from "@/src/lib/api-response";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError, updateRoomSettings } from "@/src/lib/rooms";
import { assertAuthenticatedPlayerSeat } from "@/server/auth/player-seat-guard";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  let code: string | undefined;
  let body: Record<string, unknown> | undefined;

  try {
    const session = getPlayerSession(request);
    if (!session) {
      throw new RoomError(
        "Entre em uma sala antes de alterar as configurações.",
        401,
      );
    }

    ({ code } = await params);
    await assertAuthenticatedPlayerSeat(request, session, { roomCode: code });
    body = await readJsonObject(request);
    const room = await updateRoomSettings(code, session, body);
    return noStoreJson({ room });
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "update_room_settings",
      route: request.nextUrl.pathname,
      resource: { code },
      input: body,
    });
  }
}
