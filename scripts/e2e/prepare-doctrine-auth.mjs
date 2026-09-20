import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { waitForRegistrationCode } from "./registration-otp-helper.mjs";

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

  const code = await waitForRegistrationCode(email, EMAIL_SINK_DIR);
  const verification = await browserJson(page, "/api/auth/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  assert.equal(verification.status, 200, JSON.stringify(verification.body));
  assert.equal(verification.body?.authenticated, true);

  const session = await browserJson(page, "/api/auth/get-session");
  assert.equal(session.status, 200, JSON.stringify(session.body));
  assert.ok(session.body?.user?.id, "Doctrine E2E não criou sessão Better Auth real");

  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`[doctrine-e2e] authenticated storage state: ${STORAGE_STATE_PATH}`);
  await context.close();
} finally {
  await browser.close();
}
