import { NextRequest } from "next/server";
import {
  noStoreJson,
  roomErrorResponse,
} from "@/src/lib/api-response";
import { getPlayerSession } from "@/src/lib/player-session";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
import {
  getLobbySnapshot,
  RoomError,
} from "@/src/lib/rooms";
import { assertAuthenticatedPlayerSeat } from "@/server/auth/player-seat-guard";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function requirePlayerSession(request: NextRequest) {
  const session = getPlayerSession(request);
  if (!session) {
    throw new RoomError("Entre em uma sala antes de acessar a lobby.", 401);
  }
  return session;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  let code: string | undefined;
  try {
    const session = requirePlayerSession(request);
    ({ code } = await params);
    await assertAuthenticatedPlayerSeat(request, session, { roomCode: code });
    const { snapshot, revision } = await getLobbySnapshot(code, session);
    return noStoreJson(snapshot, {
      headers: { [GAME_REVISION_HEADER]: String(revision) },
    });
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "get_lobby_snapshot",
      route: request.nextUrl.pathname,
      resource: { code },
    });
  }
}
