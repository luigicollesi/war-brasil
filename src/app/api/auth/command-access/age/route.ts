import {
  COMMAND_MINIMUM_AGE,
  saveCommanderBirthDate,
  validateCommanderBirthDate,
} from "@/server/auth/command-access";
import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/server/auth/auth-guard";
import { rejectUntrustedMutationOrigin } from "@/server/auth/request-origin";

function unavailableResponse() {
  return Response.json(
    {
      ok: false,
      code: "age_gate_unavailable",
      message: "Não foi possível verificar a idade agora.",
    },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  const rejected = rejectUntrustedMutationOrigin(request);
  if (rejected) return rejected;

  let session;
  try {
    session = await getAuthenticatedSession(request);
  } catch {
    return unavailableResponse();
  }

  if (!session) {
    return authenticationRequiredResponse();
  }

  const body = (await request.json().catch(() => null)) as {
    birthDate?: unknown;
  } | null;
  const birthDate =
    typeof body?.birthDate === "string" ? body.birthDate.trim() : "";
  const error = validateCommanderBirthDate(birthDate);

  if (error) {
    return Response.json(
      {
        ok: false,
        code: "invalid_birth_date",
        errors: { birthDate: error },
      },
      { status: 400 },
    );
  }

  try {
    const result = await saveCommanderBirthDate(session, birthDate);

    if (!result.eligible && result.accountDeleted) {
      return Response.json(
        {
          ok: false,
          code: "minimum_age_not_met",
          accountDeleted: true,
          minimumAge: COMMAND_MINIMUM_AGE,
          message:
            "Você ainda não tem a idade mínima para jogar Bellum Civile. Sua conta foi excluída.",
        },
        { status: 403 },
      );
    }

    return Response.json({
      ok: true,
      eligible: true,
      minimumAge: COMMAND_MINIMUM_AGE,
    });
  } catch {
    return unavailableResponse();
  }
}
