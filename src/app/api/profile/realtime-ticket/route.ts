import {
  authenticationRequiredResponse,
  getAuthenticatedSessionForRead,
} from "@/src/lib/server/auth/auth-guard";
import { issueUserRealtimeTicket } from "@/src/lib/server/realtime/user-realtime-ticket";

export async function POST(request: Request) {
  // Ticket issuance is read-only and the user channel only carries
  // invalidations. Reuse Better Auth's short-lived signed cookie cache instead
  // of forcing a PostgreSQL session lookup on every websocket reconnect.
  const session = await getAuthenticatedSessionForRead(request);
  if (!session) return authenticationRequiredResponse();

  if (process.env.GAME_REALTIME_ENABLED !== "true") {
    return Response.json(
      { enabled: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    return Response.json(
      { enabled: true, ...issueUserRealtimeTicket(session.user.id) },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    console.error("[user-realtime] ticket failed", error);
    return Response.json(
      { error: "USER_REALTIME_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
