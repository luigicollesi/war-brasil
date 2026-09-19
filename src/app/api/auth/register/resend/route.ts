import {
  buildRegistrationCodeEmail,
  sendAuthEmail,
} from "@/server/auth/email";
import {
  normalizeRegistrationEmail,
  resendPendingRegistration,
} from "@/server/auth/pending-registration";
import { rejectUntrustedAuthMutationOrigin } from "@/server/auth/request-origin";

export async function POST(request: Request) {
  const rejected = rejectUntrustedAuthMutationOrigin(request);
  if (rejected) {
    return rejected;
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const email =
    typeof body?.email === "string"
      ? normalizeRegistrationEmail(body.email)
      : "";

  if (!email || !email.includes("@")) {
    return Response.json(
      { ok: false, message: "Informe um email válido." },
      { status: 400 },
    );
  }

  try {
    const result = await resendPendingRegistration(email);

    if (result.dispatched && result.code) {
      const message = buildRegistrationCodeEmail(result.code);
      await sendAuthEmail({ ...message, to: email });
    }

    return Response.json({
      ok: true,
      retryAfterSeconds: result.retryAfterSeconds,
      message:
        "Se existir um cadastro pendente para esse endereço, enviaremos um novo código.",
    });
  } catch {
    return Response.json(
      {
        ok: false,
        message: "Não foi possível solicitar um novo código agora.",
      },
      { status: 503 },
    );
  }
}
