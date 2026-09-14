import { NextRequest } from "next/server";
import {
  noStoreJson,
  readJsonObject,
  roomErrorResponse,
} from "@/src/lib/api-response";
import {
  getOrCreatePlayerSession,
  persistPlayerSession,
} from "@/src/lib/player-session";
import { joinRoom } from "@/src/lib/rooms";
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

  let body: Record<string, unknown> | undefined;
  try {
    const session = getOrCreatePlayerSession(request);
    body = await readJsonObject(request);
    const room = await joinRoom(body.code, session.value, {
      userId: accountSession.user.id,
      displayName: access.profile.displayName,
      handle: access.profile.handle,
    });
    return persistPlayerSession(noStoreJson({ room }), session);
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "join_room",
      route: request.nextUrl.pathname,
      input: body,
    });
  }
}
