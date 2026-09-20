import {
  profileMutationErrorResponse,
  requireProfileMutationActor,
  requireRequestId,
} from "@/src/lib/server/profile/social-http";
import { rejectFriendRequest } from "@/src/lib/server/profile/social-service";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const actor = await requireProfileMutationActor(request);
  if ("response" in actor) return actor.response;

  try {
    const { requestId: rawRequestId } = await params;
    const requestId = requireRequestId(rawRequestId);
    const result = await rejectFriendRequest(actor.userId, requestId);
    return Response.json(result);
  } catch (error) {
    return profileMutationErrorResponse(error);
  }
}
