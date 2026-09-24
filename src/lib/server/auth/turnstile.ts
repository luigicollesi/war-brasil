import "server-only";

import {
  AUTH_CAPTCHA_RESPONSE_HEADER,
  type AuthCaptchaAction,
} from "@/src/lib/shared/auth-captcha";

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_TOKEN_MAX_LENGTH = 2_048;
const TURNSTILE_VERIFY_TIMEOUT_MS = 5_000;
const TURNSTILE_ALWAYS_PASS_TEST_SECRET =
  "1x0000000000000000000000000000000AA";

type TurnstileSiteverifyResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

function captchaResponse(message: string, status: number) {
  return Response.json(
    {
      ok: false,
      code: "captcha_verification_failed",
      message,
    },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}

function tokenFromRequest(request: Request) {
  const token = request.headers.get(AUTH_CAPTCHA_RESPONSE_HEADER)?.trim() ?? "";
  return token.length <= TURNSTILE_TOKEN_MAX_LENGTH ? token : "";
}

function expectedHostname(request: Request) {
  try {
    return new URL(request.url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export async function rejectInvalidAuthCaptcha(
  request: Request,
  expectedAction: AuthCaptchaAction,
): Promise<Response | null> {
  const token = tokenFromRequest(request);
  if (!token) {
    return captchaResponse(
      "Confirme a verificação de segurança para continuar.",
      422,
    );
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secretKey) {
    console.error("[auth-captcha] TURNSTILE_SECRET_KEY ausente");
    return captchaResponse(
      "A verificação de segurança está indisponível no momento.",
      503,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TURNSTILE_VERIFY_TIMEOUT_MS,
  );

  try {
    const body = new URLSearchParams({
      secret: secretKey,
      response: token,
    });
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error("[auth-captcha] siteverify unavailable", {
        status: response.status,
      });
      return captchaResponse(
        "A verificação de segurança está indisponível no momento.",
        503,
      );
    }

    const result = (await response.json().catch(() => null)) as
      | TurnstileSiteverifyResponse
      | null;
    const usingOfficialTestSecret =
      secretKey === TURNSTILE_ALWAYS_PASS_TEST_SECRET;

    const actionValid =
      usingOfficialTestSecret || result?.action === expectedAction;
    const hostnameValid =
      usingOfficialTestSecret ||
      result?.hostname?.toLowerCase() === expectedHostname(request);

    if (result?.success !== true || !actionValid || !hostnameValid) {
      console.warn("[auth-captcha] verification rejected", {
        expectedAction,
        action: result?.action ?? null,
        hostname: result?.hostname ?? null,
        errorCodes: result?.["error-codes"] ?? [],
      });
      return captchaResponse(
        "A verificação de segurança expirou ou não pôde ser confirmada. Tente novamente.",
        422,
      );
    }

    return null;
  } catch (error) {
    console.error("[auth-captcha] siteverify failed", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { name: "UnknownError" },
    });
    return captchaResponse(
      "A verificação de segurança está indisponível no momento.",
      503,
    );
  } finally {
    clearTimeout(timeout);
  }
}
