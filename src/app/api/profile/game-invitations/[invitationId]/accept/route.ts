import { NextRequest } from "next/server";
import { noStoreJson } from "@/src/lib/api-response";
import { persistActiveParticipationCookie } from "@/src/lib/server/auth/active-participation-cookie";
import { getCommandAccessState } from "@/src/lib/server/auth/command-access";
import {
  authenticationRequiredResponse,
  forbiddenResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { rejectUntrustedMutationOrigin } from "@/src/lib/server/auth/request-origin";
import {
  acceptGameInvitation,
  GameInvitationError,
} from "@/src/lib/server/game-invitations/invitation-service";
import {
  getOrCreatePlayerSession,
  persistPlayerSession,
} from "@/src/lib/player-session";
import { publishLobbyChangeByCode } from "@/src/lib/server/realtime/lobby-realtime-publisher";

function invitationErrorResponse(error: unknown) {
  if (error instanceof GameInvitationError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }
  console.error("[game-invitation] accept failed", error);
  return Response.json(
    {
      error: "GAME_INVITATION_UNAVAILABLE",
      message: "O convite de partida não pôde ser aceito agora.",
    },
    { status: 503 },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invitationId: string }> },
) {
  const originRejection = rejectUntrustedMutationOrigin(request);
  if (originRejection) return originRejection;

  const session = await getAuthenticatedSession(request);
  if (!session) return authenticationRequiredResponse();

  const access = await getCommandAccessState(session);
  if (!access.profileComplete || !access.profile.handle || !access.profile.displayName) {
    return forbiddenResponse();
  }

  const { invitationId } = await context.params;
  const playerSession = getOrCreatePlayerSession(request);

  try {
    const result = await acceptGameInvitation({
      inviteeUserId: session.user.id,
      invitationId,
      playerSession: playerSession.value,
      identity: {
        userId: session.user.id,
        handle: access.profile.handle,
        displayName: access.profile.displayName,
      },
    });
    await publishLobbyChangeByCode(result.roomCode);
    const response = persistPlayerSession(
      noStoreJson({ ok: true, ...result }),
      playerSession,
    );
    return persistActiveParticipationCookie(response, {
      kind: "lobby",
      roomCode: result.roomCode,
    });
  } catch (error) {
    return invitationErrorResponse(error);
  }
}
