import {
  requireProfileMutationActor,
} from "@/src/lib/server/profile/social-http";
import {
  BoundedJsonBodyError,
  readBoundedJsonBody,
} from "@/src/lib/server/http/read-bounded-json";
import {
  parseProfileSettingsUpdate,
  ProfileSettingsError,
  updateOwnProfileSettings,
} from "@/src/lib/server/profile/profile-settings-service";

function settingsErrorResponse(error: unknown) {
  if (error instanceof ProfileSettingsError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error("Falha ao atualizar configurações do Profile.", error);
  return Response.json(
    {
      error: "PROFILE_SETTINGS_UNAVAILABLE",
      message: "As configurações do Quartel estão temporariamente indisponíveis.",
    },
    { status: 503 },
  );
}

export async function PATCH(request: Request) {
  const actor = await requireProfileMutationActor(request);
  if ("response" in actor) return actor.response;

  let payload: unknown;
  try {
    payload = await readBoundedJsonBody(request);
  } catch (error) {
    if (error instanceof BoundedJsonBodyError) {
      return Response.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    throw error;
  }

  try {
    const update = parseProfileSettingsUpdate(payload);
    await updateOwnProfileSettings(actor.userId, update);
    return Response.json({ ok: true });
  } catch (error) {
    return settingsErrorResponse(error);
  }
}
