import { withE2EAuthCaptcha } from "./runtime-helper.mjs";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { waitForRegistrationCode } from "./registration-otp-helper.mjs";

const playwrightRuntimeDir = path.resolve(
  process.env.PLAYWRIGHT_RUNTIME_DIR ?? ".e2e-runtime/node_modules/playwright",
);
const playwright = await import(
  pathToFileURL(path.join(playwrightRuntimeDir, "index.mjs")).href
);

const BASE_URL = process.env.LOBBY_E2E_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.LOBBY_E2E_DATABASE_URL ?? process.env.DATABASE_URL;
const EMAIL_SINK_DIR = process.env.AUTH_EMAIL_SINK_DIR;
const PASSWORD = "WarBrasil-Expiry-E2E-2026!";
const NEW_PASSWORD = "WarBrasil-Expiry-New-E2E-2026!";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatória para o E2E temporal de auth.");
}
if (!EMAIL_SINK_DIR) {
  throw new Error("AUTH_EMAIL_SINK_DIR é obrigatória para o E2E temporal de auth.");
}

async function apiJson(page, url, init = {}) {
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
    { requestUrl: url, requestInit: withE2EAuthCaptcha(url, init) },
  );
}

async function register(page, email) {
  const response = await apiJson(page, "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      termsAccepted: true,
    }),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body?.ok, true);
}

async function signIn(page, email, password = PASSWORD) {
  return apiJson(page, "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe: true }),
  });
}

async function signOut(page) {
  return apiJson(page, "/api/auth/sign-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

async function waitForEmail(to, subject) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const entries = await readdir(EMAIL_SINK_DIR).catch(() => []);
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const raw = await readFile(path.join(EMAIL_SINK_DIR, entry), "utf8").catch(
        () => null,
      );
      if (!raw) continue;
      try {
        const message = JSON.parse(raw);
        if (message?.to === to && message?.subject === subject) return message;
      } catch {
        // O polling tenta novamente se coincidir com a escrita do sink.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`email E2E não capturado para subject=${subject}`);
}

function actionUrl(message) {
  const match = String(message?.text ?? "").match(/https?:\/\/[^\s]+/);
  assert.ok(match?.[0], "email não contém URL de ação textual");
  return match[0];
}

function tokenFromResetActionUrl(value) {
  const url = new URL(value);
  const queryToken = url.searchParams.get("token");
  if (queryToken) return queryToken;

  const segments = url.pathname.split("/").filter(Boolean);
  const resetIndex = segments.lastIndexOf("reset-password");
  const pathToken = resetIndex >= 0 ? segments[resetIndex + 1] : null;
  return pathToken ? decodeURIComponent(pathToken) : null;
}

async function expireRegistrationCode(db, email) {
  const result = await db.query(
    `UPDATE auth.pending_registration
        SET code_expires_at = NOW() - INTERVAL '1 minute',
            updated_at = NOW()
      WHERE email = $1
      RETURNING id`,
    [email],
  );
  assert.equal(result.rowCount, 1, "cadastro pendente não localizado para expiração");
}

async function expireResetToken(db, token) {
  const result = await db.query(
    `UPDATE auth.verification
        SET "expiresAt" = NOW() - INTERVAL '1 minute',
            "updatedAt" = NOW()
      WHERE identifier = $1
        AND "expiresAt" > NOW()
      RETURNING id`,
    [`reset-password:${token}`],
  );
  assert.equal(
    result.rowCount,
    1,
    "token de password reset não encontrou exatamente uma verification ativa",
  );
}

async function accountExists(db, email) {
  const result = await db.query(
    `SELECT "emailVerified" AS verified
       FROM auth."user"
      WHERE email = $1`,
    [email],
  );
  return result.rows[0] ?? null;
}

const browser = await playwright.chromium.launch({ headless: true });
const db = new Client({ connectionString: DATABASE_URL });
await db.connect();

try {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": "198.51.100.243" },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    const identity = `${process.pid}-${Date.now()}`;

    const expiredOtpEmail = `expired-otp-${identity}@e2e.war-brasil.test`;
    await register(page, expiredOtpEmail);
    const expiredOtp = await waitForRegistrationCode(
      expiredOtpEmail,
      EMAIL_SINK_DIR,
    );
    await expireRegistrationCode(db, expiredOtpEmail);

    const expiredVerification = await apiJson(
      page,
      "/api/auth/register/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: expiredOtpEmail, code: expiredOtp }),
      },
    );
    assert.equal(
      expiredVerification.status,
      410,
      `OTP expirado deveria retornar 410, recebeu ${expiredVerification.status}`,
    );
    assert.equal(
      await accountExists(db, expiredOtpEmail),
      null,
      "OTP expirado não pode criar auth.user",
    );

    const expiredOtpSignIn = await signIn(page, expiredOtpEmail);
    assert.ok(
      expiredOtpSignIn.status >= 400 && expiredOtpSignIn.status < 500,
      `cadastro não promovido deveria falhar login, recebeu ${expiredOtpSignIn.status}`,
    );

    const resetEmail = `expired-reset-${identity}@e2e.war-brasil.test`;
    await register(page, resetEmail);
    const resetRegistrationCode = await waitForRegistrationCode(
      resetEmail,
      EMAIL_SINK_DIR,
    );
    const registrationVerification = await apiJson(
      page,
      "/api/auth/register/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail,
          code: resetRegistrationCode,
        }),
      },
    );
    assert.equal(
      registrationVerification.status,
      200,
      JSON.stringify(registrationVerification.body),
    );
    assert.equal((await accountExists(db, resetEmail))?.verified, true);

    const logout = await signOut(page);
    assert.equal(logout.status, 200, JSON.stringify(logout.body));

    const requestReset = await apiJson(page, "/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: resetEmail,
        redirectTo: "/?auth=reset-password",
      }),
    });
    assert.equal(requestReset.status, 200, JSON.stringify(requestReset.body));

    const resetMessage = await waitForEmail(resetEmail, "Redefinição de senha | WAR Brasil");
    const rawResetUrl = actionUrl(resetMessage);
    const expiredResetToken = tokenFromResetActionUrl(rawResetUrl);
    assert.ok(expiredResetToken, "URL de reset não expôs token Better Auth na ação server-side");
    await expireResetToken(db, expiredResetToken);

    const expiredReset = await apiJson(page, "/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newPassword: NEW_PASSWORD,
        token: expiredResetToken,
      }),
    });
    assert.ok(
      expiredReset.status >= 400 && expiredReset.status < 500,
      `token de reset expirado deveria ser rejeitado, recebeu ${expiredReset.status}`,
    );

    const oldPasswordStillValid = await signIn(page, resetEmail, PASSWORD);
    assert.equal(
      oldPasswordStillValid.status,
      200,
      "token expirado alterou a senha existente",
    );

    const newPasswordMustFail = await signIn(page, resetEmail, NEW_PASSWORD);
    assert.ok(
      newPasswordMustFail.status >= 400 && newPasswordMustFail.status < 500,
      "senha enviada com token expirado foi persistida",
    );

    console.log(
      "[auth-token-expiry-e2e] expiração de OTP e password reset falharam fechados.",
    );
  } finally {
    await context.close();
  }
} finally {
  await db.end();
  await browser.close();
}
