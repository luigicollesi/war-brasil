import { NextRequest } from "next/server";
import {
  noStoreEmpty,
  noStoreJson,
  roomErrorResponse,
} from "@/src/lib/api-response";
import { getGameSnapshotQuery } from "@/src/lib/game-snapshot-service";
import {
  GAME_REVISION_HEADER,
  GAME_TOPOLOGY_HEADER,
  GAME_TOPOLOGY_VERSION,
  parseGameRevision,
} from "@/src/lib/game-sync-contract";
import { getPlayerSession } from "@/src/lib/player-session";
import { RoomError } from "@/src/lib/rooms";
import { getAuthenticatedSessionForRead } from "@/server/auth/auth-guard";

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
    const accountSession = await getAuthenticatedSessionForRead(request);
    if (!accountSession) {
      throw new RoomError("Autenticação necessária para acessar esta partida.", 401);
    }

    const knownTopology = request.headers.get(GAME_TOPOLOGY_HEADER);
    const knownRevision = parseGameRevision(
      request.headers.get(GAME_REVISION_HEADER),
    );
    const revisionForFastPath =
      knownTopology === GAME_TOPOLOGY_VERSION ? knownRevision : null;
    const topologyIsKnown = knownTopology === GAME_TOPOLOGY_VERSION;
    const result = await getGameSnapshotQuery(
      roomId,
      session,
      accountSession.user.id,
      revisionForFastPath,
      { includeConnections: !topologyIsKnown },
    );
    const headers = {
      [GAME_REVISION_HEADER]: String(result.revision),
      [GAME_TOPOLOGY_HEADER]: GAME_TOPOLOGY_VERSION,
    };

    if (!result.snapshot) {
      return noStoreEmpty({ status: 204, headers });
    }

    if (topologyIsKnown) {
      const dynamicSnapshot: Partial<typeof result.snapshot> = {
        ...result.snapshot,
      };
      delete dynamicSnapshot.connections;
      return noStoreJson(dynamicSnapshot, { headers });
    }

    return noStoreJson(result.snapshot, { headers });
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "get_game_snapshot",
      route: request.nextUrl.pathname,
      resource: { roomId },
    });
  }
}
