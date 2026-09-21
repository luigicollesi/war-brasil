import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { issueUserRealtimeTicket } from "@/src/lib/server/realtime/user-realtime-ticket";

export async function POST(request: Request) {
  const session = await getAuthenticatedSession(request);
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
