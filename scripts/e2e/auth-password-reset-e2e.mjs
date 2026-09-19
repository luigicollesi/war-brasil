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
const OLD_PASSWORD = "WarBrasil-Reset-Old-2026!";
const NEW_PASSWORD = "WarBrasil-Reset-New-2026!";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatória para o E2E de password reset.");
}
if (!EMAIL_SINK_DIR) {
  throw new Error("AUTH_EMAIL_SINK_DIR é obrigatória para o E2E de password reset.");
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
        // Se a leitura coincidir com a criação do arquivo, tentamos novamente.
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

async function register(page, email) {
  const response = await apiJson(page, "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: OLD_PASSWORD,
      termsAccepted: true,
    }),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body?.ok, true);
}

async function signIn(page, email, password) {
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

async function getSession(page) {
  const response = await apiJson(page, "/api/auth/get-session");
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

async function activeSessionCount(db, email) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count
       FROM auth.session s
       JOIN auth."user" u ON u.id = s."userId"
      WHERE u.email = $1
        AND s."expiresAt" > NOW()`,
    [email],
  );
  return result.rows[0]?.count ?? 0;
}

const browser = await playwright.chromium.launch({ headless: true });
const db = new Client({ connectionString: DATABASE_URL });
await db.connect();

try {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": "198.51.100.241" },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });

    const identity = `${process.pid}-${Date.now()}`;
    const email = `reset-${identity}@e2e.war-brasil.test`;
    await register(page, email);

    const registrationCode = await waitForRegistrationCode(
      email,
      EMAIL_SINK_DIR,
    );
    const verification = await apiJson(page, "/api/auth/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: registrationCode }),
    });
    assert.equal(verification.status, 200, JSON.stringify(verification.body));
    assert.equal(verification.body?.authenticated, true);

    const verified = await db.query(
      `SELECT "emailVerified" AS verified
         FROM auth."user"
        WHERE email = $1`,
      [email],
    );
    assert.equal(verified.rows[0]?.verified, true, "fixture não foi verificada");

    const verificationSignOut = await signOut(page);
    assert.equal(
      verificationSignOut.status,
      200,
      JSON.stringify(verificationSignOut.body),
    );

    const initialSignIn = await signIn(page, email, OLD_PASSWORD);
    assert.equal(initialSignIn.status, 200, JSON.stringify(initialSignIn.body));
    assert.ok((await getSession(page))?.user, "login inicial não criou sessão");
    assert.equal(await activeSessionCount(db, email), 1, "login inicial não persistiu uma sessão ativa");

    const requestReset = await apiJson(page, "/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        redirectTo: "/?auth=reset-password",
      }),
    });
    assert.equal(requestReset.status, 200, JSON.stringify(requestReset.body));

    const missingReset = await apiJson(page, "/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `missing-${identity}@e2e.war-brasil.test`,
        redirectTo: "/?auth=reset-password",
      }),
    });
    assert.equal(missingReset.status, 200, JSON.stringify(missingReset.body));
    assert.equal(
      JSON.stringify(missingReset.body),
      JSON.stringify(requestReset.body),
      "forgot-password distinguiu conta existente de inexistente",
    );

    const resetMessage = await waitForEmail(email, "Redefinição de senha");
    assert.match(resetMessage.html ?? "", /REDEFINIR SENHA/);
    assert.match(resetMessage.text ?? "", /válido por 1 hora/i);

    await page.goto(actionUrl(resetMessage), { waitUntil: "domcontentloaded" });
    const resetLanding = new URL(page.url());
    assert.equal(resetLanding.pathname, "/");
    assert.equal(resetLanding.searchParams.get("auth"), "reset-password");
    const token = resetLanding.searchParams.get("token");
    assert.ok(token, "callback de reset não forneceu token Better Auth");

    const reset = await apiJson(page, "/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newPassword: NEW_PASSWORD,
        token,
      }),
    });
    assert.equal(reset.status, 200, JSON.stringify(reset.body));

    assert.equal(
      await activeSessionCount(db, email),
      0,
      "password reset não revogou a sessão autoritativa no banco",
    );

    const protectedAfterReset = await apiJson(page, "/api/auth/command-access");
    assert.equal(
      protectedAfterReset.status,
      401,
      `cache client não pode manter privilégio após reset; recebeu ${protectedAfterReset.status}`,
    );

    // O cookie cache do Better Auth pode continuar refletindo a identidade antiga
    // por poucos minutos. Isso não concede privilégio porque os endpoints sensíveis
    // ignoram o cache. O logout abaixo representa o cleanup executado pelo cliente.
    const logout = await signOut(page);
    assert.equal(logout.status, 200, JSON.stringify(logout.body));
    assert.equal(
      (await getSession(page))?.user ?? null,
      null,
      "logout pós-reset não limpou o estado client residual",
    );

    const oldPasswordSignIn = await signIn(page, email, OLD_PASSWORD);
    assert.ok(
      oldPasswordSignIn.status >= 400 && oldPasswordSignIn.status < 500,
      `senha antiga deveria falhar, recebeu ${oldPasswordSignIn.status}`,
    );
    assert.equal(
      (await getSession(page))?.user ?? null,
      null,
      "senha antiga não pode restaurar sessão",
    );

    const replay = await apiJson(page, "/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newPassword: "WarBrasil-Replay-Must-Not-Apply-2026!",
        token,
      }),
    });
    assert.ok(
      replay.status >= 400 && replay.status < 500,
      `replay de reset deveria ser rejeitado, recebeu ${replay.status}`,
    );

    const newPasswordSignIn = await signIn(page, email, NEW_PASSWORD);
    assert.equal(newPasswordSignIn.status, 200, JSON.stringify(newPasswordSignIn.body));
    assert.ok((await getSession(page))?.user, "senha nova não criou sessão");

    console.log(
      "[auth-password-reset-e2e] reset real, não-enumeração, revogação autoritativa, cleanup client, senha antiga e replay confirmados.",
    );
  } finally {
    await context.close();
  }
} finally {
  await db.end();
  await browser.close();
}
