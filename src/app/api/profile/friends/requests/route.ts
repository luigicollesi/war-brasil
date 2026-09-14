import {
  profileMutationErrorResponse,
  readHandlePayload,
  requireProfileMutationActor,
} from "@/src/lib/server/profile/social-http";
import { sendFriendRequest } from "@/src/lib/server/profile/social-service";

export async function POST(request: Request) {
  const actor = await requireProfileMutationActor(request);
  if ("response" in actor) return actor.response;

  try {
    const handle = await readHandlePayload(request);
    const result = await sendFriendRequest(actor.userId, handle);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return profileMutationErrorResponse(error);
  }
}
