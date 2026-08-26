import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { gameQuery } from "@/src/lib/game-query";
import { readPlayerGameRevision } from "@/src/lib/game-revision";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
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
    if (!/^\d+$/.test(roomId)) {
      throw new RoomError("Partida não encontrada.", 404);
    }

    const revision = await gameQuery((client) =>
      readPlayerGameRevision(client, roomId!, session),
    );

    return noStoreJson(
      { revision },
      { headers: { [GAME_REVISION_HEADER]: String(revision) } },
    );
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "get_game_revision",
      route: request.nextUrl.pathname,
      resource: { roomId },
    });
  }
}
