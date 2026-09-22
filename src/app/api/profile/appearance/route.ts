import {
  authenticationRequiredResponse,
  getAuthenticatedSessionForRead,
} from "@/src/lib/server/auth/auth-guard";
import {
  getOwnProfileAppearance,
  parseProfileAppearanceUpdate,
  ProfileAppearanceError,
  updateOwnProfileAppearance,
} from "@/src/lib/server/profile/profile-appearance-service";
import { requireProfileMutationActor } from "@/src/lib/server/profile/social-http";

function appearanceErrorResponse(error: unknown) {
  if (error instanceof ProfileAppearanceError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error("Falha ao acessar aparência do Profile.", error);
  return Response.json(
    {
      error: "PROFILE_APPEARANCE_UNAVAILABLE",
      message: "A aparência do comandante está temporariamente indisponível.",
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const session = await getAuthenticatedSessionForRead(request);
  if (!session) return authenticationRequiredResponse();

  try {
    return Response.json(await getOwnProfileAppearance(session.user.id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return appearanceErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
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
    const update = parseProfileAppearanceUpdate(payload);
    await updateOwnProfileAppearance(actor.userId, update);
    return Response.json({ ok: true });
  } catch (error) {
    return appearanceErrorResponse(error);
  }
}
