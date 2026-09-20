import {
  profileMutationErrorResponse,
  requireCommanderHandle,
  requireProfileMutationActor,
} from "@/src/lib/server/profile/social-http";
import { removeFriend } from "@/src/lib/server/profile/social-service";

type RouteContext = {
  params: Promise<{ handle: string }>;
};

export async function DELETE(request: Request, { params }: RouteContext) {
  const actor = await requireProfileMutationActor(request);
  if ("response" in actor) return actor.response;

  try {
    const { handle: rawHandle } = await params;
    const handle = requireCommanderHandle(rawHandle);
    const result = await removeFriend(actor.userId, handle);
    return Response.json(result);
  } catch (error) {
    return profileMutationErrorResponse(error);
  }
}
