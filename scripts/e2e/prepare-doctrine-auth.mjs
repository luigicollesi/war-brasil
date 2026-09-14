import assert from "node:assert/strict";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const EMAIL_SINK_DIR = process.env.AUTH_EMAIL_SINK_DIR;
const STORAGE_STATE_PATH =
  process.env.DOCTRINE_AUTH_STORAGE_STATE ??
  "test-results/doctrine-auth-state.json";
const PASSWORD = "WarBrasil-Doctrine-E2E-2026!";

if (!EMAIL_SINK_DIR) {
  throw new Error("AUTH_EMAIL_SINK_DIR é obrigatória para autenticar o Doctrine E2E.");
}

async function browserJson(page, url, init = {}) {
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
  const deadline = Date.now() + 10_000;
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
        // A leitura pode coincidir com a escrita atômica do sink; tentamos novamente.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`email Doctrine E2E não capturado para subject=${subject}`);
}

function actionUrl(message) {
  const match = String(message?.text ?? "").match(/https?:\/\/[^\s]+/);
  assert.ok(match?.[0], "email de verificação não contém URL de ação");
  return match[0];
}

await mkdir(EMAIL_SINK_DIR, { recursive: true });
await mkdir(path.dirname(STORAGE_STATE_PATH), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });

  const email = `doctrine-${process.pid}-${Date.now()}@e2e.war-brasil.test`;
  const register = await browserJson(page, "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      termsAccepted: true,
    }),
  });
  assert.equal(register.status, 200, JSON.stringify(register.body));
  assert.equal(register.body?.ok, true, JSON.stringify(register.body));

  const verificationMessage = await waitForEmail(email, "Verificação de email");
  await page.goto(actionUrl(verificationMessage), { waitUntil: "domcontentloaded" });

  const signIn = await browserJson(page, "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, rememberMe: true }),
  });
  assert.equal(signIn.status, 200, JSON.stringify(signIn.body));

  const session = await browserJson(page, "/api/auth/get-session");
  assert.equal(session.status, 200, JSON.stringify(session.body));
  assert.ok(session.body?.user?.id, "Doctrine E2E não criou sessão Better Auth real");

  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`[doctrine-e2e] authenticated storage state: ${STORAGE_STATE_PATH}`);
  await context.close();
} finally {
  await browser.close();
}
