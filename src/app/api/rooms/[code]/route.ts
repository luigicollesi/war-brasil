import { NextRequest } from "next/server";
import {
  noStoreJson,
  roomErrorResponse,
} from "@/src/lib/api-response";
import { getPlayerSession } from "@/src/lib/player-session";
import {
  getLobbySnapshot,
  RoomError,
} from "@/src/lib/rooms";

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
    const snapshot = await getLobbySnapshot(code, session);
    return noStoreJson(snapshot);
  } catch (error) {
    return roomErrorResponse(error, { operation: "get_lobby_snapshot", route: request.nextUrl.pathname, resource: { code } });
  }
}
