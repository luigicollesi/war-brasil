import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { rejectUntrustedMutationOrigin } from "@/src/lib/server/auth/request-origin";
import {
  cancelGameInvitation,
  GameInvitationError,
  listGameInvitations,
} from "@/src/lib/server/game-invitations/invitation-service";

function invitationErrorResponse(error: unknown) {
  if (error instanceof GameInvitationError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }
  console.error("[game-invitation] request failed", error);
  return Response.json(
    {
      error: "GAME_INVITATION_UNAVAILABLE",
      message: "Os convites de partida estão temporariamente indisponíveis.",
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const session = await getAuthenticatedSession(request);
  if (!session) return authenticationRequiredResponse();

  try {
    const invitations = await listGameInvitations(session.user.id);
    return Response.json(
      invitations,
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return invitationErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const originRejection = rejectUntrustedMutationOrigin(request);
  if (originRejection) return originRejection;

  const session = await getAuthenticatedSession(request);
  if (!session) return authenticationRequiredResponse();

  const invitationId = new URL(request.url).searchParams.get("id") ?? "";
  try {
    const result = await cancelGameInvitation(session.user.id, invitationId);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return invitationErrorResponse(error);
  }
}
