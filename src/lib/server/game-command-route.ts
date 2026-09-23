import "server-only";

import type { NextRequest } from "next/server";
import { readJsonObject, roomErrorResponse } from "@/src/lib/api-response";
import type { GameCommandRequestMetadata } from "@/src/lib/game-command-request";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";
import { readGameCommandRequestMetadata } from "@/src/lib/server/game-command-request";
import { getAuthenticatedSession } from "@/src/lib/server/auth/auth-guard";

type GameRoomRouteContext = {
  params: Promise<{ roomId: string }>;
};

type GameCommandContext<TBody> = {
  roomId: string;
  session: string;
  accountUserId: string;
  metadata: GameCommandRequestMetadata | null;
  body: TBody;
};

type GameCommandRouteOptions<TBody> = {
  operation: string;
  missingSessionMessage?: string;
  execute: (
    context: GameCommandContext<TBody>,
  ) => Response | Promise<Response>;
};

function createGameCommandEnvelope<TBody>(
  {
    operation,
    missingSessionMessage = "Entre em uma sala antes de jogar.",
    execute,
  }: GameCommandRouteOptions<TBody>,
  readBody: (request: NextRequest) => Promise<TBody>,
) {
  return async function POST(
    request: NextRequest,
    { params }: GameRoomRouteContext,
  ) {
    let roomId: string | undefined;
    let body: TBody | undefined;

    try {
      const session = getPlayerSession(request);
      if (!session) {
        throw new RoomError(missingSessionMessage, 401);
      }

      ({ roomId } = await params);
      const accountSession = await getAuthenticatedSession(request);
      if (!accountSession) {
        throw new RoomError(
          "Autenticação necessária para acessar este assento.",
          401,
        );
      }
      const metadata = readGameCommandRequestMetadata(request);
      body = await readBody(request);

      return await execute({
        roomId,
        session,
        accountUserId: accountSession.user.id,
        metadata,
        body,
      });
    } catch (error) {
      return roomErrorResponse(error, {
        operation,
        route: request.nextUrl.pathname,
        resource: { roomId },
        ...(body === undefined ? {} : { input: body }),
      });
    }
  };
}

export function createGameCommandRoute(
  options: GameCommandRouteOptions<undefined>,
) {
  return createGameCommandEnvelope(options, async () => undefined);
}

export function createGameJsonCommandRoute(
  options: GameCommandRouteOptions<Record<string, unknown>>,
) {
  return createGameCommandEnvelope(options, readJsonObject);
}
