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
const PASSWORD = "WarBrasil-Session-E2E-2026!";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatória para o E2E de sessão.");
}
if (!EMAIL_SINK_DIR) {
  throw new Error("AUTH_EMAIL_SINK_DIR é obrigatória para o E2E de sessão.");
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
        // Arquivo ainda pode estar sendo escrito; o polling tenta novamente.
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

async function registerAndVerify(page, email) {
  const registration = await apiJson(page, "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      termsAccepted: true,
    }),
  });
  assert.equal(registration.status, 200, JSON.stringify(registration.body));

  const verificationMessage = await waitForEmail(email, "Verificação de email");
  await page.goto(actionUrl(verificationMessage), { waitUntil: "domcontentloaded" });
}

async function signIn(page, email) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/sign-in/email") &&
      response.request().method() === "POST",
  );
  const requestPromise = apiJson(page, "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, rememberMe: true }),
  });

  const [networkResponse, result] = await Promise.all([
    responsePromise,
    requestPromise,
  ]);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return networkResponse;
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

function assertPublicSessionPayload(session) {
  const serialized = JSON.stringify(session ?? {});
  for (const forbidden of [
    "accessToken",
    "refreshToken",
    "idToken",
    "password",
    "passwordHash",
    "clientSecret",
    "privateKey",
  ]) {
    assert.doesNotMatch(
      serialized,
      new RegExp(`\\"${forbidden}\\"`, "i"),
      `payload público expôs ${forbidden}`,
    );
  }
}

const browser = await playwright.chromium.launch({ headless: true });
const db = new Client({ connectionString: DATABASE_URL });
await db.connect();

try {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": "198.51.100.242" },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    const identity = `${process.pid}-${Date.now()}`;
    const email = `session-${identity}@e2e.war-brasil.test`;
    await registerAndVerify(page, email);

    const signInResponse = await signIn(page, email);
    const setCookieHeaders = (await signInResponse.headersArray())
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value);
    const sessionSetCookie = setCookieHeaders.find((header) =>
      /war-brasil[^=]*session/i.test(header),
    );
    assert.ok(sessionSetCookie, "login não emitiu cookie de sessão War-Brasil");
    assert.match(sessionSetCookie, /HttpOnly/i, "cookie de sessão precisa ser HttpOnly");
    assert.match(sessionSetCookie, /SameSite=Lax/i, "cookie de sessão precisa usar SameSite=Lax");
    assert.doesNotMatch(sessionSetCookie, /;\s*Domain=/i, "cookie deve permanecer host-only");

    const cookies = await context.cookies(BASE_URL);
    const sessionCookie = cookies.find((cookie) =>
      /war-brasil.*session/i.test(cookie.name),
    );
    assert.ok(sessionCookie?.value, "cookie de sessão não apareceu no jar do browser");
    assert.equal(sessionCookie.httpOnly, true, "cookie no browser não está HttpOnly");
    assert.equal(sessionCookie.sameSite, "Lax", "SameSite do browser divergiu");

    const storage = await page.evaluate(async () => ({
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
      indexedDb: typeof indexedDB.databases === "function"
        ? (await indexedDB.databases()).map((database) => database.name ?? "")
        : [],
    }));
    const storageSerialized = JSON.stringify(storage);
    assert.equal(
      storageSerialized.includes(sessionCookie.value),
      false,
      "token de sessão foi serializado em storage do browser",
    );
    assert.equal(
      storage.indexedDb.some((name) => /auth|session|token/i.test(name)),
      false,
      "auth criou IndexedDB custom para sessão/token",
    );

    const session = await getSession(page);
    assert.ok(session?.user, "sessão autenticada não foi restaurada");
    assertPublicSessionPayload(session);

    await page.goto(`${BASE_URL}/matchmaking`, { waitUntil: "domcontentloaded" });
    assert.equal(new URL(page.url()).pathname, "/matchmaking");

    const expired = await db.query(
      `UPDATE auth.session s
          SET "expiresAt" = NOW() - INTERVAL '1 minute',
              "updatedAt" = NOW()
         FROM auth."user" u
        WHERE s."userId" = u.id
          AND u.email = $1
        RETURNING s.id`,
      [email],
    );
    assert.ok((expired.rowCount ?? 0) >= 1, "sessão E2E não foi localizada para expiração");

    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    const expiredGate = await apiJson(page, "/api/auth/command-access");
    assert.equal(
      expiredGate.status,
      401,
      `sessão expirada deveria falhar fechada; recebeu ${expiredGate.status}`,
    );

    await signIn(page, email);
    assert.ok((await getSession(page))?.user, "novo login não restaurou sessão");

    const logout = await signOut(page);
    assert.equal(logout.status, 200, JSON.stringify(logout.body));
    assert.equal((await getSession(page))?.user ?? null, null, "logout não removeu sessão");

    const protectedAfterLogout = await apiJson(page, "/api/auth/command-access");
    assert.equal(protectedAfterLogout.status, 401, "logout não revogou acesso protegido");

    await page.goto(`${BASE_URL}/matchmaking`, { waitUntil: "domcontentloaded" });
    assert.equal(
      new URL(page.url()).pathname,
      "/",
      "rota protegida não redirecionou para Home após logout",
    );

    const cookiesAfterLogout = await context.cookies(BASE_URL);
    assert.equal(
      cookiesAfterLogout.some((cookie) => /war-brasil.*session/i.test(cookie.name)),
      false,
      "cookie de sessão permaneceu após logout",
    );

    console.log(
      "[auth-session-security-e2e] HttpOnly/SameSite/host-only, storage, expiração, payload e logout confirmados.",
    );
  } finally {
    await context.close();
  }
} finally {
  await db.end();
  await browser.close();
}

await import("./auth-token-expiry-e2e.mjs");
