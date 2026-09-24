import { withE2EAuthCaptcha } from "./runtime-helper.mjs";
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
const PASSWORD = "WarBrasil-Home-E2E-2026!";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatória para o E2E da Home auth.");
}
if (!EMAIL_SINK_DIR) {
  throw new Error("AUTH_EMAIL_SINK_DIR é obrigatória para o E2E da Home auth.");
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
        // O próximo ciclo lê novamente se o sink ainda estiver finalizando a escrita.
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
    body: JSON.stringify({ email, password: PASSWORD, termsAccepted: true }),
  });
  assert.equal(registration.status, 200, JSON.stringify(registration.body));

  const message = await waitForEmail(email, "Verificação de email");
  await page.goto(actionUrl(message), { waitUntil: "domcontentloaded" });
}

async function signIn(page, email) {
  const result = await apiJson(page, "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, rememberMe: true }),
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
}

async function enterCommand(page) {
  await page.getByRole("button", { name: "ENTRAR NO COMANDO", exact: true }).click();
}

async function expireSessions(db, email) {
  const result = await db.query(
    `UPDATE auth.session s
        SET "expiresAt" = NOW() - INTERVAL '1 minute',
            "updatedAt" = NOW()
       FROM auth."user" u
      WHERE s."userId" = u.id
        AND u.email = $1
      RETURNING s.id`,
    [email],
  );
  assert.ok((result.rowCount ?? 0) >= 1, "nenhuma sessão foi encontrada para expirar");
}

const browser = await playwright.chromium.launch({ headless: true });
const db = new Client({ connectionString: DATABASE_URL });
await db.connect();

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
    extraHTTPHeaders: { "x-forwarded-for": "198.51.100.245" },
  });
  await context.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, ...args) {
      if (typeof type === "string" && type.toLowerCase().startsWith("webgl")) {
        return null;
      }
      return originalGetContext.call(this, type, ...args);
    };
  });

  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    assert.equal(
      await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches),
      true,
    );

    await enterCommand(page);
    await page.getByRole("heading", { name: "Entrar no Comando" }).waitFor({
      state: "visible",
      timeout: 8_000,
    });
    assert.equal(
      await page.locator('main[data-command-open="true"]').count(),
      0,
      "guest abriu o Comando sem autenticação",
    );
    await page.getByRole("button", { name: "Fechar autenticação" }).click();

    const identity = `${process.pid}-${Date.now()}`;
    const email = `home-${identity}@e2e.war-brasil.test`;
    await registerAndVerify(page, email);
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await signIn(page, email);
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });

    await enterCommand(page);
    await page.getByRole("heading", { name: "Definir comandante" }).waitFor({
      state: "visible",
      timeout: 8_000,
    });
    assert.equal(
      await page.locator('main[data-command-open="true"]').count(),
      0,
      "perfil incompleto abriu o Comando antes do onboarding",
    );

    await page.getByRole("textbox", { name: "Nome de exibição" }).fill("Comandante Home E2E");
    await page
      .getByRole("textbox", { name: "Identificador de comando" })
      .fill(`home_${identity}`);
    await page.getByRole("button", { name: "CONCLUIR REGISTRO", exact: true }).click();

    await page.getByText("COMANDO AUTORIZADO", { exact: true }).waitFor({
      state: "visible",
      timeout: 8_000,
    });
    assert.equal(
      await page.locator('main[data-command-open="true"]').count(),
      1,
      "onboarding concluído não abriu o Comando",
    );

    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await enterCommand(page);
    await page.getByText("COMANDO AUTORIZADO", { exact: true }).waitFor({
      state: "visible",
      timeout: 8_000,
    });
    assert.equal(
      await page.getByRole("heading", { name: "Entrar no Comando" }).count(),
      0,
      "sessão válida abriu modal em vez de reutilizar cookie",
    );

    await expireSessions(db, email);
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await enterCommand(page);
    await page.getByRole("heading", { name: "Entrar no Comando" }).waitFor({
      state: "visible",
      timeout: 8_000,
    });
    assert.equal(
      await page.locator('main[data-command-open="true"]').count(),
      0,
      "sessão expirada abriu o Comando por estado client stale",
    );

    console.log(
      "[auth-home-e2e] guest, onboarding, cookie salvo, sessão expirada, reduced-motion e fallback WebGL confirmados.",
    );
  } finally {
    await context.close();
  }
} finally {
  await db.end();
  await browser.close();
}
