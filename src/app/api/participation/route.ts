import { NextRequest } from "next/server";
import { noStoreJson, roomErrorResponse } from "@/src/lib/api-response";
import {
  clearActiveParticipationCookie,
  persistActiveParticipationCookie,
} from "@/src/lib/server/auth/active-participation-cookie";
import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { resumeActiveParticipation } from "@/src/lib/server/game-participation-service";
import {
  getOrCreatePlayerSession,
  persistPlayerSession,
} from "@/src/lib/player-session";

export async function POST(request: NextRequest) {
  const accountSession = await getAuthenticatedSession(request).catch(() => null);
  if (!accountSession) return authenticationRequiredResponse();

  const playerSession = getOrCreatePlayerSession(request);

  try {
    const participation = await resumeActiveParticipation(
      accountSession.user.id,
      playerSession.value,
    );

    let response = persistPlayerSession(
      noStoreJson({ participation }),
      playerSession,
    );

    response = participation
      ? persistActiveParticipationCookie(response, {
          kind: participation.kind,
          roomCode: participation.roomCode,
        })
      : clearActiveParticipationCookie(response);

    return response;
  } catch (error) {
    return roomErrorResponse(error, {
      operation: "resume_active_participation",
      route: request.nextUrl.pathname,
    });
  }
}
