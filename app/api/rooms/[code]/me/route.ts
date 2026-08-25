import { NextRequest } from "next/server";
import {
  noStoreJson,
  readJsonObject,
  roomErrorResponse,
} from "@/src/lib/api-response";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError, updateLobbyPlayer } from "@/src/lib/rooms";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  let code: string | undefined;
  let body: Record<string, unknown> | undefined;
  try {
    const session = getPlayerSession(request);
    if (!session) {
      throw new RoomError("Entre em uma sala antes de atualizar a lobby.", 401);
    }

    ({ code } = await params);
    body = await readJsonObject(request);
    const room = await updateLobbyPlayer(code, session, body);
    return noStoreJson({ room });
  } catch (error) {
    return roomErrorResponse(error, { operation: "update_lobby_player", route: request.nextUrl.pathname, resource: { code }, input: body });
  }
}
