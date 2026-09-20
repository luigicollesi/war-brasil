import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { rejectUntrustedMutationOrigin } from "@/src/lib/server/auth/request-origin";
import {
  GameInvitationError,
  rejectGameInvitation,
} from "@/src/lib/server/game-invitations/invitation-service";

function invitationErrorResponse(error: unknown) {
  if (error instanceof GameInvitationError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }
  console.error("[game-invitation] reject failed", error);
  return Response.json(
    {
      error: "GAME_INVITATION_UNAVAILABLE",
      message: "O convite de partida não pôde ser recusado agora.",
    },
    { status: 503 },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ invitationId: string }> },
) {
  const originRejection = rejectUntrustedMutationOrigin(request);
  if (originRejection) return originRejection;

  const session = await getAuthenticatedSession(request);
  if (!session) return authenticationRequiredResponse();

  const { invitationId } = await context.params;
  try {
    const result = await rejectGameInvitation(session.user.id, invitationId);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return invitationErrorResponse(error);
  }
}
