import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { rejectUntrustedMutationOrigin } from "@/src/lib/server/auth/request-origin";
import { markNotificationRead } from "@/src/lib/server/profile/notification-repository";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  const originRejection = rejectUntrustedMutationOrigin(request);
  if (originRejection) return originRejection;

  const session = await getAuthenticatedSession(request);
  if (!session) return authenticationRequiredResponse();

  const { notificationId } = await context.params;
  if (!UUID_PATTERN.test(notificationId)) {
    return Response.json(
      { error: "INVALID_NOTIFICATION_ID" },
      { status: 400 },
    );
  }

  const acknowledged = await markNotificationRead(
    session.user.id,
    notificationId,
  );
  return Response.json({ ok: true, acknowledged });
}
