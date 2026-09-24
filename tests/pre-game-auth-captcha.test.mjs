import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shared = readFileSync("src/lib/shared/auth-captcha.ts", "utf8");
const verifier = readFileSync("src/lib/server/auth/turnstile.ts", "utf8");
const authRoute = readFileSync("src/app/api/auth/[...all]/route.ts", "utf8");
const registerRoute = readFileSync("src/app/api/auth/register/route.ts", "utf8");
const resendRoute = readFileSync(
  "src/app/api/auth/register/resend/route.ts",
  "utf8",
);
const verifyRoute = readFileSync(
  "src/app/api/auth/register/verify/route.ts",
  "utf8",
);
const modal = readFileSync(
  "src/components/auth/command-auth-modal.tsx",
  "utf8",
);
const widget = readFileSync(
  "src/components/auth/turnstile-challenge.tsx",
  "utf8",
);
const envExample = readFileSync(".env.example", "utf8");
const testWorkflow = readFileSync(".github/workflows/test.yml", "utf8");

test("Turnstile valida no servidor com timeout, action e hostname", () => {
  assert.match(verifier, /^import "server-only";/m);
  assert.match(
    verifier,
    /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/,
  );
  assert.match(verifier, /TURNSTILE_VERIFY_TIMEOUT_MS = 5_000/);
  assert.match(verifier, /TURNSTILE_TOKEN_MAX_LENGTH = 2_048/);
  assert.match(verifier, /result\?\.action === expectedAction/);
  assert.match(
    verifier,
    /result\?\.hostname\?\.toLowerCase\(\) === expectedHostname\(request\)/,
  );
  assert.match(verifier, /cache: "no-store"/);
  assert.doesNotMatch(verifier, /console\.(?:log|info|warn|error)\([^\n]*token/i);
});

test("login e recuperação são protegidos no boundary HTTP sem interceptar sign-in interno", () => {
  assert.match(authRoute, /\/api\/auth\/sign-in\/email/);
  assert.match(authRoute, /AUTH_CAPTCHA_ACTIONS\.login/);
  assert.match(authRoute, /\/api\/auth\/request-password-reset/);
  assert.match(authRoute, /AUTH_CAPTCHA_ACTIONS\.forgotPassword/);
  assert.match(authRoute, /rejectInvalidAuthCaptcha/);
  assert.doesNotMatch(verifyRoute, /rejectInvalidAuthCaptcha|TURNSTILE/);
  assert.match(verifyRoute, /auth\.api\.signInEmail/);
});

test("cadastro e reenvio validam captcha antes de banco e email", () => {
  const registerCaptcha = registerRoute.indexOf(
    "const rejectedCaptcha = await rejectInvalidAuthCaptcha",
  );
  const beginRegistration = registerRoute.indexOf(
    "const pending = await beginPendingRegistration",
  );
  const resendCaptcha = resendRoute.indexOf(
    "const rejectedCaptcha = await rejectInvalidAuthCaptcha",
  );
  const resendRegistration = resendRoute.indexOf(
    "const result = await resendPendingRegistration",
  );

  assert.ok(registerCaptcha >= 0 && registerCaptcha < beginRegistration);
  assert.ok(resendCaptcha >= 0 && resendCaptcha < resendRegistration);
  assert.match(registerRoute, /AUTH_CAPTCHA_ACTIONS\.register/);
  assert.match(resendRoute, /AUTH_CAPTCHA_ACTIONS\.resendRegistration/);
});

test("modal envia token single-use por header e reseta depois de cada tentativa", () => {
  assert.match(shared, /AUTH_CAPTCHA_RESPONSE_HEADER = "x-captcha-response"/);
  assert.match(modal, /AUTH_CAPTCHA_RESPONSE_HEADER/);
  assert.match(modal, /fetchOptions:[\s\S]*headers:/);
  assert.match(modal, /resetCaptcha/);
  assert.match(modal, /finally \{[\s\S]*resetCaptcha\(\)/);
  assert.match(modal, /disabled=\{isPending \|\| !captchaToken\}/);
  assert.match(modal, /AUTH_CAPTCHA_ACTIONS\.login/);
  assert.match(modal, /AUTH_CAPTCHA_ACTIONS\.register/);
  assert.match(modal, /AUTH_CAPTCHA_ACTIONS\.resendRegistration/);
  assert.match(modal, /AUTH_CAPTCHA_ACTIONS\.forgotPassword/);
});

test("OTP e redefinição final não recebem desafio adicional", () => {
  const verificationBlock =
    modal.match(/\{mode === "verification"[\s\S]*?\{mode === "forgot"/)?.[0] ??
    "";
  const resetBlock =
    modal.match(/\{mode === "reset"[\s\S]*?<footer/)?.[0] ?? "";

  assert.match(verificationBlock, /submitVerification/);
  assert.match(verificationBlock, /resendVerification/);
  assert.match(verificationBlock, /resendRegistration/);
  assert.doesNotMatch(
    verifyRoute,
    /AUTH_CAPTCHA_RESPONSE_HEADER|rejectInvalidAuthCaptcha/,
  );
  assert.doesNotMatch(resetBlock, /TurnstileChallenge/);
});

test("widget usa somente site key pública; secret permanece server-only", () => {
  assert.match(widget, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  assert.match(widget, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(widget, /render=explicit/);
  assert.match(widget, /"expired-callback"/);
  assert.match(widget, /"error-callback"/);
  assert.doesNotMatch(widget + modal, /TURNSTILE_SECRET_KEY/);
  assert.match(verifier, /TURNSTILE_SECRET_KEY/);
  assert.match(envExample, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  assert.match(envExample, /TURNSTILE_SECRET_KEY/);
});

test("CI usa as credenciais oficiais always-pass do Turnstile", () => {
  assert.match(testWorkflow, /1x00000000000000000000AA/);
  assert.match(testWorkflow, /1x0000000000000000000000000000000AA/);
});
