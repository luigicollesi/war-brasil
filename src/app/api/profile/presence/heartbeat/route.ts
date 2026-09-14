import { renewOwnPresence } from "@/src/lib/server/profile/presence-gateway";
import { requireProfileMutationActor } from "@/src/lib/server/profile/social-http";

export async function POST(request: Request) {
  const actor = await requireProfileMutationActor(request);
  if ("response" in actor) return actor.response;

  const presence = await renewOwnPresence(actor.userId);
  if (presence.state === "unavailable") {
    return Response.json(
      { availability: "unavailable", state: "unavailable" },
      { status: 503 },
    );
  }

  return Response.json({
    availability: "available",
    state: "online",
    lastSeenAt: presence.lastSeenAt,
  });
}
