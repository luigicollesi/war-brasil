import { renewOwnPresence } from "@/src/lib/server/profile/presence-gateway";
import { persistCommanderLastSeen } from "@/src/lib/server/profile/presence-persistence";
import { requireProfileMutationActor } from "@/src/lib/server/profile/social-http";

export async function POST(request: Request) {
  const actor = await requireProfileMutationActor(request);
  if ("response" in actor) return actor.response;

  const presence = await renewOwnPresence(actor.userId);
  if (presence.state === "unavailable") {
    return Response.json(
      { availability: "unavailable", state: "unavailable" },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Profile-Presence": "unavailable",
        },
      },
    );
  }

  if (presence.shouldPersistLastSeen && presence.lastSeenAt) {
    await persistCommanderLastSeen(actor.userId, presence.lastSeenAt);
  }

  return Response.json(
    {
      availability: "available",
      state: "online",
      lastSeenAt: presence.lastSeenAt,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Profile-Presence": "available",
      },
    },
  );
}
