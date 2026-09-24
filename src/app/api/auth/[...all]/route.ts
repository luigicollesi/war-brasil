import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/auth";
import {
  AUTH_CAPTCHA_ACTIONS,
  type AuthCaptchaAction,
} from "@/src/lib/shared/auth-captcha";
import { rejectUntrustedAuthMutationOrigin } from "@/server/auth/request-origin";
import { rejectInvalidAuthCaptcha } from "@/server/auth/turnstile";

const handlers = toNextJsHandler(auth);

function captchaActionForRequest(request: Request): AuthCaptchaAction | null {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/auth/sign-in/email") {
    return AUTH_CAPTCHA_ACTIONS.login;
  }
  if (pathname === "/api/auth/request-password-reset") {
    return AUTH_CAPTCHA_ACTIONS.forgotPassword;
  }
  return null;
}

export const GET = handlers.GET;

export async function POST(request: Request) {
  const rejected = rejectUntrustedAuthMutationOrigin(request);
  if (rejected) {
    return rejected;
  }

  const captchaAction = captchaActionForRequest(request);
  if (captchaAction) {
    const rejectedCaptcha = await rejectInvalidAuthCaptcha(
      request,
      captchaAction,
    );
    if (rejectedCaptcha) {
      return rejectedCaptcha;
    }
  }

  return handlers.POST(request);
}
