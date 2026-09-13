import assert from "node:assert/strict";
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
const PASSWORD = "WarBrasil-Verify-E2E-2026!";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatória para o E2E de verification.");
}
if (!EMAIL_SINK_DIR) {
  throw new Error("AUTH_EMAIL_SINK_DIR é obrigatória para o E2E de verification.");
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

async function getSession(page) {
  const response = await apiJson(page, "/api/auth/get-session");
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
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
        // O writer usa rename-free atomicidade de um único writeFile; uma leitura
        // que coincida com a criação pode simplesmente tentar novamente.
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

async function userVerificationState(db, email) {
  const result = await db.query(
    `SELECT "emailVerified" AS verified
       FROM auth."user"
      WHERE email = $1`,
    [email],
  );
  assert.equal(result.rowCount, 1, "usuário credentials não foi persistido");
  return result.rows[0].verified === true;
}

const browser = await playwright.chromium.launch({ headless: true });
const db = new Client({ connectionString: DATABASE_URL });
await db.connect();

try {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": "198.51.100.240" },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });

    const identity = `${process.pid}-${Date.now()}`;
    const verifiedEmail = `verify-${identity}@e2e.war-brasil.test`;
    await register(page, verifiedEmail);

    assert.equal(
      await userVerificationState(db, verifiedEmail),
      false,
      "signup credentials não pode nascer verificado",
    );
    assert.equal(
      (await getSession(page))?.user ?? null,
      null,
      "signup credentials não pode criar sessão",
    );

    const verificationMessage = await waitForEmail(
      verifiedEmail,
      "Verificação de email",
    );
    assert.match(verificationMessage.html ?? "", /VERIFICAR EMAIL/);
    assert.match(verificationMessage.text ?? "", /válido por 1 hora/i);
    const verificationUrl = actionUrl(verificationMessage);

    await page.goto(verificationUrl, { waitUntil: "domcontentloaded" });
    const verifiedUrl = new URL(page.url());
    assert.equal(verifiedUrl.pathname, "/");
    assert.equal(verifiedUrl.searchParams.get("emailVerified"), "success");
    assert.equal(
      await userVerificationState(db, verifiedEmail),
      true,
      "link válido não marcou emailVerified",
    );
    assert.equal(
      (await getSession(page))?.user ?? null,
      null,
      "verification não pode autenticar automaticamente",
    );

    await page.goto(verificationUrl, { waitUntil: "domcontentloaded" });
    assert.equal(
      await userVerificationState(db, verifiedEmail),
      true,
      "replay não pode regredir verification",
    );
    assert.equal(
      (await getSession(page))?.user ?? null,
      null,
      "replay do link não pode criar sessão",
    );

    const invalidEmail = `invalid-${identity}@e2e.war-brasil.test`;
    await register(page, invalidEmail);
    const invalidMessage = await waitForEmail(invalidEmail, "Verificação de email");
    const validSecondUrl = new URL(actionUrl(invalidMessage));
    assert.ok(validSecondUrl.searchParams.has("token"), "URL Better Auth sem token");
    validSecondUrl.searchParams.set("token", "invalid-e2e-token");

    await page.goto(validSecondUrl.toString(), { waitUntil: "domcontentloaded" });
    assert.equal(
      await userVerificationState(db, invalidEmail),
      false,
      "token inválido não pode verificar conta",
    );
    assert.equal(
      (await getSession(page))?.user ?? null,
      null,
      "token inválido não pode criar sessão",
    );

    const signIn = await apiJson(page, "/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: verifiedEmail,
        password: PASSWORD,
        rememberMe: true,
      }),
    });
    assert.equal(signIn.status, 200, JSON.stringify(signIn.body));
    assert.ok((await getSession(page))?.user, "login pós-verification não criou sessão");

    console.log(
      "[auth-verification-e2e] signup sem sessão, link real, replay, token inválido e login pós-verification confirmados.",
    );
  } finally {
    await context.close();
  }
} finally {
  await db.end();
  await browser.close();
}
