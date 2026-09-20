import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { requireProfileMutationActor } from "@/src/lib/server/profile/social-http";
import {
  equipOwnedCommanderTitle,
  listOwnedCommanderTitles,
  parseCommanderTitleSelection,
  ProfileTitleError,
} from "@/src/lib/server/profile/profile-title-service";

function titleErrorResponse(error: unknown) {
  if (error instanceof ProfileTitleError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error("Falha ao acessar títulos cosméticos do Profile.", error);
  return Response.json(
    {
      error: "PROFILE_TITLES_UNAVAILABLE",
      message: "Os títulos do comandante estão temporariamente indisponíveis.",
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const session = await getAuthenticatedSession(request);
  if (!session) return authenticationRequiredResponse();

  try {
    const titles = await listOwnedCommanderTitles(session.user.id);
    return Response.json(
      { titles },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return titleErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const actor = await requireProfileMutationActor(request);
  if ("response" in actor) return actor.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "INVALID_JSON", message: "Corpo JSON inválido." },
      { status: 400 },
    );
  }

  try {
    const titleId = parseCommanderTitleSelection(payload);
    await equipOwnedCommanderTitle(actor.userId, titleId);
    return Response.json({ ok: true });
  } catch (error) {
    return titleErrorResponse(error);
  }
}
