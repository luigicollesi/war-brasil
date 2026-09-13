import { auth } from "@/server/auth/auth";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function genericRegistrationResponse() {
  return Response.json({
    ok: true,
    message: "Confira seu email para concluir o cadastro.",
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    termsAccepted?: unknown;
  } | null;

  const email = typeof body?.email === "string" ? body.email.trim() : "";
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

  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");

  const forwardedRequest = new Request(
    new URL("/api/auth/sign-up/email", request.url),
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        name: "Comandante",
        password,
        callbackURL: "/?emailVerified=success&continue=command",
      }),
    },
  );

  const response = await auth.handler(forwardedRequest);

  if (response.ok) {
    return genericRegistrationResponse();
  }

  if (response.status === 429) {
    return Response.json(
      {
        ok: false,
        message: "Muitas tentativas. Aguarde antes de tentar novamente.",
      },
      { status: 429 },
    );
  }

  // Não propagar mensagens que permitam distinguir conta existente de conta
  // inexistente. Erros de formato/política já foram tratados acima.
  return Response.json(
    {
      ok: false,
      message: "Não foi possível iniciar o cadastro agora.",
    },
    { status: response.status >= 500 ? 503 : 400 },
  );
}
