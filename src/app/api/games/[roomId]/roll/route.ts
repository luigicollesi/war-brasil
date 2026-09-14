import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import { rollOrderDieCommand } from "@/src/lib/game-command-service";
import { readGameCommandRequestMetadata } from "@/src/lib/server/game-command-request";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";
import { assertAuthenticatedPlayerSeat } from "@/server/auth/player-seat-guard";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  let roomId: string | undefined;

  try {
    const session = getPlayerSession(request);
    if (!session) {
      throw new RoomError("Entre em uma sala antes de rolar o dado.", 401);
    }

    ({ roomId } = await params);
    await assertAuthenticatedPlayerSeat(request, session, { roomId });
    const metadata = readGameCommandRequestMetadata(request);
    const result = await rollOrderDieCommand(roomId, session, metadata);

    return noStoreJson(
      { ...result.value, revision: result.revision },
      {
        headers: {
          [GAME_REVISION_HEADER]: String(result.revision),
        },
      },
    );
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "roll_order_die",
      route: request.nextUrl.pathname,
      resource: { roomId },
    });
  }
}
