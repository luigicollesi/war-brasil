import "server-only";

import type { NextRequest } from "next/server";
import { readJsonObject, roomErrorResponse } from "@/src/lib/api-response";
import type { GameCommandRequestMetadata } from "@/src/lib/game-command-request";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";
import { readGameCommandRequestMetadata } from "@/src/lib/server/game-command-request";
import { assertAuthenticatedPlayerSeat } from "@/server/auth/player-seat-guard";

type GameRoomRouteContext = {
  params: Promise<{ roomId: string }>;
};

type GameJsonCommandContext = {
  roomId: string;
  session: string;
  body: Record<string, unknown>;
  metadata: GameCommandRequestMetadata | null;
};

type GameJsonCommandRouteOptions = {
  operation: string;
  missingSessionMessage?: string;
  execute: (
    context: GameJsonCommandContext,
  ) => Response | Promise<Response>;
};

export function createGameJsonCommandRoute({
  operation,
  missingSessionMessage = "Entre em uma sala antes de jogar.",
  execute,
}: GameJsonCommandRouteOptions) {
  return async function POST(
    request: NextRequest,
    { params }: GameRoomRouteContext,
  ) {
    let roomId: string | undefined;
    let body: Record<string, unknown> | undefined;

    try {
      const session = getPlayerSession(request);
      if (!session) {
        throw new RoomError(missingSessionMessage, 401);
      }

      ({ roomId } = await params);
      await assertAuthenticatedPlayerSeat(request, session, { roomId });
      const metadata = readGameCommandRequestMetadata(request);
      body = await readJsonObject(request);

      return await execute({ roomId, session, body, metadata });
    } catch (error) {
      return roomErrorResponse(error, {
        operation,
        route: request.nextUrl.pathname,
        resource: { roomId },
        input: body,
      });
    }
  };
}
