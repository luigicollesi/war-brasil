import { NextRequest } from "next/server";
import {
  noStoreJson,
  readJsonObject,
  roomErrorResponse,
} from "@/src/lib/api-response";
import { getPlayerSession } from "@/src/lib/player-session";
import {
  leaveWaitingRoom,
  RoomError,
  updateLobbyPlayer,
} from "@/src/lib/rooms";
import { assertAuthenticatedPlayerSeat } from "@/server/auth/player-seat-guard";
import { publishLobbyChangeByCode } from "@/src/lib/server/realtime/lobby-realtime-publisher";

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
    await assertAuthenticatedPlayerSeat(request, session, { roomCode: code });
    body = await readJsonObject(request);
    const room = await updateLobbyPlayer(code, session, body);
    await publishLobbyChangeByCode(room.code);
    return noStoreJson({ room });
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "update_lobby_player",
      route: request.nextUrl.pathname,
      resource: { code },
      input: body,
    });
  }
}


export async function DELETE(request: NextRequest, { params }: RouteContext) {
  let code: string | undefined;
  try {
    const session = getPlayerSession(request);
    if (!session) {
      throw new RoomError("Entre em uma sala antes de sair dela.", 401);
    }

    ({ code } = await params);
    await assertAuthenticatedPlayerSeat(request, session, { roomCode: code });
    const result = await leaveWaitingRoom(code, session);
    await publishLobbyChangeByCode(code);
    return noStoreJson({ ok: true, ...result });
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "leave_waiting_room",
      route: request.nextUrl.pathname,
      resource: { code },
    });
  }
}
