import {
  buildRegistrationCodeEmail,
  sendAuthEmail,
} from "@/server/auth/email";
import {
  beginPendingRegistration,
  normalizeRegistrationEmail,
} from "@/server/auth/pending-registration";
import { rejectUntrustedAuthMutationOrigin } from "@/server/auth/request-origin";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function genericRegistrationResponse(retryAfterSeconds = 60) {
  return Response.json({
    ok: true,
    retryAfterSeconds,
    message: "Enviamos um código de confirmação para seu email.",
  });
}

export async function POST(request: Request) {
  const rejected = rejectUntrustedAuthMutationOrigin(request);
  if (rejected) {
    return rejected;
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    termsAccepted?: unknown;
  } | null;

  const email =
    typeof body?.email === "string"
      ? normalizeRegistrationEmail(body.email)
      : "";
  const password =
    typeof body?.password === "string" ? body.password : "";
  const termsAccepted = body?.termsAccepted === true;
  const errors: Record<string, string> = {};

  if (!email || !email.includes("@")) {
    errors.email = "Informe um email válido.";
  }
  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    errors.password = `Use entre ${MIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres.`;
  }
  if (!termsAccepted) {
    errors.termsAccepted = "Aceite os termos para criar a conta.";
  }

  if (Object.keys(errors).length > 0) {
    return Response.json({ ok: false, errors }, { status: 400 });
  }

  try {
    const pending = await beginPendingRegistration({ email, password });

    if (pending.dispatched && pending.code) {
      const message = buildRegistrationCodeEmail(pending.code);
      await sendAuthEmail({ ...message, to: email });
    }

    return genericRegistrationResponse(pending.retryAfterSeconds);
  } catch {
    return Response.json(
      {
        ok: false,
        message: "Não foi possível iniciar o cadastro agora.",
      },
      { status: 503 },
    );
  }
}
