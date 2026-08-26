import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { getGameSnapshot } from "@/src/lib/game";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: RouteContext) {
  let roomId: string | undefined;
  try {
    const session = getPlayerSession(request);
    if (!session) {
      throw new RoomError("Entre em uma sala antes de acessar a partida.", 401);
    }

    ({ roomId } = await params);
    return noStoreJson(await getGameSnapshot(roomId, session));
  } catch (error) {
    return roomErrorResponse(error, { operation: "get_game_snapshot", route: request.nextUrl.pathname, resource: { roomId } });
  }
}
