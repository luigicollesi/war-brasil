import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

const playwrightRuntimeDir = path.resolve(
  process.env.PLAYWRIGHT_RUNTIME_DIR ?? ".e2e-runtime/node_modules/playwright",
);
const playwright = await import(
  pathToFileURL(path.join(playwrightRuntimeDir, "index.mjs")).href
);

const BASE_URL = process.env.LOBBY_E2E_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.LOBBY_E2E_DATABASE_URL ?? process.env.DATABASE_URL;
const EMAIL_SINK_DIR = process.env.AUTH_EMAIL_SINK_DIR;
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const PASSWORD = "WarBrasil-Expiry-E2E-2026!";
const NEW_PASSWORD = "WarBrasil-Expiry-New-E2E-2026!";
const EXPECTED_TOKEN_TTL_SECONDS = 60 * 60;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatória para o E2E temporal de auth.");
}
if (!EMAIL_SINK_DIR) {
  throw new Error("AUTH_EMAIL_SINK_DIR é obrigatória para o E2E temporal de auth.");
}
if (!BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET é obrigatória para o E2E temporal de auth.");
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
    { requestUrl: url, requestInit: init },
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
}

async function signIn(page, email, password = PASSWORD) {
  return apiJson(page, "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe: true }),
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
        if (message?.to === to && message?.subject === subject) {
          return message;
        }
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

function verificationTokenFromActionUrl(value) {
  const token = new URL(value).searchParams.get("token");
  assert.ok(token, "URL de verification não contém token");
  return token;
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  assert.equal(parts.length, 3, "verification token deveria ser JWT compacto");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

function signExpiredVerificationJwt(email) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      email: email.toLowerCase(),
      iat: now - 2 * EXPECTED_TOKEN_TTL_SECONDS,
      exp: now - EXPECTED_TOKEN_TTL_SECONDS,
    }),
  ).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", BETTER_AUTH_SECRET)
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
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

async function isVerified(db, email) {
  const result = await db.query(
    `SELECT "emailVerified" AS verified
       FROM auth."user"
      WHERE email = $1`,
    [email],
  );
  assert.equal(result.rowCount, 1, `usuário E2E ausente: ${email}`);
  return result.rows[0].verified === true;
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

    const expiredVerificationEmail = `expired-verify-${identity}@e2e.war-brasil.test`;
    await register(page, expiredVerificationEmail);
    const verificationMessage = await waitForEmail(
      expiredVerificationEmail,
      "Verificação de email",
    );
    const liveVerificationToken = verificationTokenFromActionUrl(
      actionUrl(verificationMessage),
    );
    const livePayload = decodeJwtPayload(liveVerificationToken);
    assert.equal(
      livePayload.exp - livePayload.iat,
      EXPECTED_TOKEN_TTL_SECONDS,
      "verification JWT real não possui TTL de 1 hora",
    );
    assert.equal(
      livePayload.email,
      expiredVerificationEmail,
      "verification JWT real não pertence ao email esperado",
    );

    const expiredVerificationToken = signExpiredVerificationJwt(
      expiredVerificationEmail,
    );
    const expiredVerificationUrl = new URL("/api/auth/verify-email", BASE_URL);
    expiredVerificationUrl.searchParams.set("token", expiredVerificationToken);
    expiredVerificationUrl.searchParams.set("callbackURL", "/?auth=email-verified");

    await page.goto(expiredVerificationUrl.href, { waitUntil: "domcontentloaded" });
    assert.equal(
      await isVerified(db, expiredVerificationEmail),
      false,
      "verification JWT autenticamente assinado mas expirado verificou a conta",
    );

    const expiredVerificationSignIn = await signIn(
      page,
      expiredVerificationEmail,
    );
    assert.ok(
      expiredVerificationSignIn.status >= 400 &&
        expiredVerificationSignIn.status < 500,
      `conta não verificada por token expirado deveria falhar login, recebeu ${expiredVerificationSignIn.status}`,
    );

    const resetEmail = `expired-reset-${identity}@e2e.war-brasil.test`;
    await register(page, resetEmail);
    const validVerification = await waitForEmail(resetEmail, "Verificação de email");
    await page.goto(actionUrl(validVerification), { waitUntil: "domcontentloaded" });
    assert.equal(await isVerified(db, resetEmail), true, "fixture de reset não foi verificada");

    const requestReset = await apiJson(page, "/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: resetEmail,
        redirectTo: "/?auth=reset-password",
      }),
    });
    assert.equal(requestReset.status, 200, JSON.stringify(requestReset.body));

    const resetMessage = await waitForEmail(resetEmail, "Redefinição de senha");
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
      "[auth-token-expiry-e2e] TTL real de verification e expiração de verification/reset falharam fechados.",
    );
  } finally {
    await context.close();
  }
} finally {
  await db.end();
  await browser.close();
}
