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
  createFriendRoomInvitation,
  GameInvitationError,
} from "@/src/lib/server/game-invitations/invitation-service";
import {
  getOrCreatePlayerSession,
  persistPlayerSession,
} from "@/src/lib/player-session";

function invitationErrorResponse(error: unknown) {
  if (error instanceof GameInvitationError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }
  console.error("[game-invitation] create failed", error);
  return Response.json(
    {
      error: "GAME_INVITATION_UNAVAILABLE",
      message: "O convite de partida não pôde ser criado agora.",
    },
    { status: 503 },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ handle: string }> },
) {
  const originRejection = rejectUntrustedMutationOrigin(request);
  if (originRejection) return originRejection;

  const session = await getAuthenticatedSession(request);
  if (!session) return authenticationRequiredResponse();

  const access = await getCommandAccessState(session);
  if (!access.profileComplete || !access.profile.handle || !access.profile.displayName) {
    return forbiddenResponse();
  }

  const { handle } = await context.params;
  const playerSession = getOrCreatePlayerSession(request);

  try {
    const invitation = await createFriendRoomInvitation({
      actorUserId: session.user.id,
      targetHandle: handle,
      playerSession: playerSession.value,
      identity: {
        userId: session.user.id,
        handle: access.profile.handle,
        displayName: access.profile.displayName,
      },
    });

    const response = persistPlayerSession(
      noStoreJson({ ok: true, ...invitation }),
      playerSession,
    );
    return persistActiveParticipationCookie(response, {
      kind: "lobby",
      roomCode: invitation.roomCode,
    });
  } catch (error) {
    return invitationErrorResponse(error);
  }
}
