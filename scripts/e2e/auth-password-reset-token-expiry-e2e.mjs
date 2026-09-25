import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { waitForRegistrationCode } from "./registration-otp-helper.mjs";
import {
  NEW_PASSWORD,
  PASSWORD,
  accountExists,
  actionUrl,
  apiJson,
  expireResetToken,
  register,
  signIn,
  signOut,
  tokenFromResetActionUrl,
  waitForEmail,
} from "./auth-token-expiry-helper.mjs";

const playwrightRuntimeDir = path.resolve(
  process.env.PLAYWRIGHT_RUNTIME_DIR ?? ".e2e-runtime/node_modules/playwright",
);
const playwright = await import(
  pathToFileURL(path.join(playwrightRuntimeDir, "index.mjs")).href
);

const BASE_URL = process.env.LOBBY_E2E_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.LOBBY_E2E_DATABASE_URL ?? process.env.DATABASE_URL;
const EMAIL_SINK_DIR = process.env.AUTH_EMAIL_SINK_DIR;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatória para o E2E temporal de auth.");
}
if (!EMAIL_SINK_DIR) {
  throw new Error("AUTH_EMAIL_SINK_DIR é obrigatória para o E2E temporal de auth.");
}

const browser = await playwright.chromium.launch({ headless: true });
const db = new Client({ connectionString: DATABASE_URL });
await db.connect();

try {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": "198.51.100.244" },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    const identity = `${process.pid}-${Date.now()}`;
    const email = `expired-reset-${identity}@e2e.war-brasil.test`;

    await register(page, email);
    const registrationCode = await waitForRegistrationCode(email, EMAIL_SINK_DIR);
    const registrationVerification = await apiJson(
      page,
      "/api/auth/register/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: registrationCode }),
      },
    );

    assert.equal(
      registrationVerification.status,
      200,
      JSON.stringify(registrationVerification.body),
    );
    assert.equal((await accountExists(db, email))?.verified, true);

    const logout = await signOut(page);
    assert.equal(logout.status, 200, JSON.stringify(logout.body));

    const requestReset = await apiJson(page, "/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        redirectTo: "/?auth=reset-password",
      }),
    });
    assert.equal(requestReset.status, 200, JSON.stringify(requestReset.body));

    const resetMessage = await waitForEmail(
      EMAIL_SINK_DIR,
      email,
      "Redefinição de senha | WAR Brasil",
    );
    const token = tokenFromResetActionUrl(actionUrl(resetMessage));
    assert.ok(token, "URL de reset não expôs token Better Auth na ação server-side");
    await expireResetToken(db, token);

    const expiredReset = await apiJson(page, "/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: NEW_PASSWORD, token }),
    });
    assert.ok(
      expiredReset.status >= 400 && expiredReset.status < 500,
      `token de reset expirado deveria ser rejeitado, recebeu ${expiredReset.status}`,
    );

    const oldPasswordStillValid = await signIn(page, email, PASSWORD);
    assert.equal(
      oldPasswordStillValid.status,
      200,
      "token expirado alterou a senha existente",
    );

    const newPasswordMustFail = await signIn(page, email, NEW_PASSWORD);
    assert.ok(
      newPasswordMustFail.status >= 400 && newPasswordMustFail.status < 500,
      "senha enviada com token expirado foi persistida",
    );

    console.log(
      "[auth-password-reset-token-expiry-e2e] token expirado de password reset falhou fechado.",
    );
  } finally {
    await context.close();
  }
} finally {
  await db.end();
  await browser.close();
}
