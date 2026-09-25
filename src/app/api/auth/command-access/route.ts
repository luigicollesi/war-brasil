import {
  CommanderAgeGateRequiredError,
  CommanderHandleConflictError,
  getCommandAccessState,
  saveCommanderIdentity,
} from "@/server/auth/command-access";
import { parseCommanderIdentityWriteDto } from "@/src/lib/profile/commander-name-contract";
import { CommanderNamePolicyError } from "@/src/lib/server/profile/commander-name-policy";
import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/server/auth/auth-guard";

function authUnavailableResponse() {
  return Response.json(
    {
      error: "authentication_unavailable",
      message: "Não foi possível validar o acesso ao Comando agora.",
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  try {
    const session = await getAuthenticatedSession(request);
    if (!session) {
      return authenticationRequiredResponse();
    }

    return Response.json(await getCommandAccessState(session));
  } catch {
    return authUnavailableResponse();
  }
}

export async function PUT(request: Request) {
  let session;
  try {
    session = await getAuthenticatedSession(request);
  } catch {
    return authUnavailableResponse();
  }

  if (!session) {
    return authenticationRequiredResponse();
  }

  const body = await request.json().catch(() => null);
  const parsed = parseCommanderIdentityWriteDto(body);

  if (!parsed.ok) {
    return Response.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  try {
    const profile = await saveCommanderIdentity(session, parsed.value);
    return Response.json({
      ok: true,
      authenticated: true,
      profileComplete: true,
      profile,
    });
  } catch (error) {
    if (error instanceof CommanderAgeGateRequiredError) {
      return Response.json(
        {
          ok: false,
          code: "age_gate_required",
          message: "Informe sua data de nascimento antes de definir o comandante.",
        },
        { status: 403 },
      );
    }

    if (error instanceof CommanderNamePolicyError) {
      return Response.json(
        {
          ok: false,
          errors: {
            [error.field]: error.publicMessage,
          },
        },
        { status: 400 },
      );
    }

    if (error instanceof CommanderHandleConflictError) {
      return Response.json(
        {
          ok: false,
          errors: {
            handle: "Este identificador de comando já está em uso.",
          },
        },
        { status: 409 },
      );
    }

    return Response.json(
      {
        ok: false,
        message: "Não foi possível salvar a identidade de comando agora.",
      },
      { status: 503 },
    );
  }
}
