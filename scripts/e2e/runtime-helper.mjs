import path from "node:path";
import { pathToFileURL } from "node:url";

const E2E_AUTH_CAPTCHA_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const CAPTCHA_PROTECTED_PATHS = new Set([
  "/api/auth/register",
  "/api/auth/register/resend",
  "/api/auth/sign-in/email",
  "/api/auth/request-password-reset",
]);

export function withE2EAuthCaptcha(url, init = {}) {
  const method = String(init.method ?? "GET").toUpperCase();
  const pathname = new URL(url, "http://e2e.local").pathname;
  if (method !== "POST" || !CAPTCHA_PROTECTED_PATHS.has(pathname)) {
    return init;
  }

  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "x-captcha-response": E2E_AUTH_CAPTCHA_TOKEN,
    },
  };
}

export async function loadPlaywrightRuntime() {
  const runtimeDir = path.resolve(
    process.env.PLAYWRIGHT_RUNTIME_DIR ?? ".e2e-runtime/node_modules/playwright",
  );
  return import(pathToFileURL(path.join(runtimeDir, "index.mjs")).href);
}

export async function apiJson(page, url, init = {}) {
  const requestInit = withE2EAuthCaptcha(url, init);
  return page.evaluate(
    async ({ requestUrl, requestInit }) => {
      const response = await fetch(requestUrl, requestInit);
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { status: response.status, body };
    },
    { requestUrl: url, requestInit },
  );
}
