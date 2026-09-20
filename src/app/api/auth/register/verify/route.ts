import { auth } from "@/server/auth/auth";
import {
  normalizeRegistrationEmail,
  verifyPendingRegistration,
} from "@/server/auth/pending-registration";
import { rejectUntrustedAuthMutationOrigin } from "@/server/auth/request-origin";

const CODE_PATTERN = /^\d{6}$/;

function copySetCookieHeaders(source: Headers, target: Headers) {
  const sourceWithCookies = source as Headers & {
    getSetCookie?: () => string[];
  };
  const cookies =
    typeof sourceWithCookies.getSetCookie === "function"
      ? sourceWithCookies.getSetCookie()
      : source.get("set-cookie")
        ? [source.get("set-cookie")!]
        : [];

  for (const cookie of cookies) {
    target.append("set-cookie", cookie);
  }
}

export async function POST(request: Request) {
  const rejected = rejectUntrustedAuthMutationOrigin(request);
  if (rejected) {
    return rejected;
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    code?: unknown;
  } | null;

  const email =
    typeof body?.email === "string"
      ? normalizeRegistrationEmail(body.email)
      : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!email || !email.includes("@") || !CODE_PATTERN.test(code)) {
    return Response.json(
      {
        ok: false,
        message: "Informe o email e o código de 6 dígitos enviados para você.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await verifyPendingRegistration(email, code);

    if (result.status !== "created") {
      if (result.status === "too_many_attempts") {
        return Response.json(
          {
            ok: false,
            message:
              "Limite de tentativas atingido. Solicite um novo código para continuar.",
          },
          { status: 429 },
        );
      }

      if (result.status === "expired") {
        return Response.json(
          {
            ok: false,
            message: "Este código expirou. Solicite um novo código.",
          },
          { status: 410 },
        );
      }

      if (result.status === "account_exists") {
        return Response.json(
          {
            ok: false,
            message:
              "Esta conta já foi confirmada. Entre normalmente com sua credencial.",
          },
          { status: 409 },
        );
      }

      return Response.json(
        {
          ok: false,
          message: "Código inválido. Confira os 6 dígitos e tente novamente.",
        },
        { status: 400 },
      );
    }

    const signIn = await auth.api.signInEmail({
      returnHeaders: true,
      headers: request.headers,
      body: {
        email: result.email,
        password: result.password,
        rememberMe: true,
      },
    });

    const headers = new Headers({
      "cache-control": "no-store",
      "content-type": "application/json",
    });
    copySetCookieHeaders(signIn.headers, headers);

    return new Response(
      JSON.stringify({
        ok: true,
        authenticated: true,
        next: "onboarding",
      }),
      {
        status: 200,
        headers,
      },
    );
  } catch (error) {
    console.error("[auth-register] verify failed", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { name: "UnknownError" },
    });

    return Response.json(
      {
        ok: false,
        message: "Não foi possível confirmar o cadastro agora.",
      },
      { status: 503 },
    );
  }
}
