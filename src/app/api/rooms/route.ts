import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import {
  getOrCreatePlayerSession,
  persistPlayerSession,
} from "@/src/lib/player-session";
import { createRoom } from "@/src/lib/rooms";
import { persistActiveParticipationCookie } from "@/src/lib/server/auth/active-participation-cookie";
import { getCommandAccessState } from "@/server/auth/command-access";
import {
  authenticationRequiredResponse,
  forbiddenResponse,
  getAuthenticatedSession,
} from "@/server/auth/auth-guard";

export async function POST(request: NextRequest) {
  const accountSession = await getAuthenticatedSession(request).catch(() => null);
  if (!accountSession) {
    return authenticationRequiredResponse();
  }

  const access = await getCommandAccessState(accountSession).catch(() => null);
  if (
    !access?.profileComplete ||
    !access.profile.handle ||
    !access.profile.displayName
  ) {
    return forbiddenResponse();
  }

  try {
    const session = getOrCreatePlayerSession(request);
    const room = await createRoom(session.value, {
      userId: accountSession.user.id,
      displayName: access.profile.displayName,
      handle: access.profile.handle,
    });
    const response = persistPlayerSession(noStoreJson({ room }), session);
    return persistActiveParticipationCookie(response, {
      kind: "lobby",
      roomCode: room.code,
    });
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "create_room",
      route: request.nextUrl.pathname,
    });
  }
}
