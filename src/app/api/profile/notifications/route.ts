import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
  getAuthenticatedSessionForRead,
} from "@/src/lib/server/auth/auth-guard";
import { listUnreadNotifications } from "@/src/lib/server/profile/notification-repository";

export async function GET(request: Request) {
  const session = await getAuthenticatedSessionForRead(request);
  if (!session) return authenticationRequiredResponse();

  const notifications = await listUnreadNotifications(session.user.id);
  return Response.json(
    { notifications },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
