import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { waitForRegistrationCode } from "./registration-otp-helper.mjs";
import {
  accountExists,
  apiJson,
  expireRegistrationCode,
  register,
  signIn,
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
    extraHTTPHeaders: { "x-forwarded-for": "198.51.100.243" },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    const identity = `${process.pid}-${Date.now()}`;
    const email = `expired-otp-${identity}@e2e.war-brasil.test`;

    await register(page, email);
    const code = await waitForRegistrationCode(email, EMAIL_SINK_DIR);
    await expireRegistrationCode(db, email);

    const verification = await apiJson(page, "/api/auth/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    assert.equal(
      verification.status,
      410,
      `OTP expirado deveria retornar 410, recebeu ${verification.status}`,
    );
    assert.equal(
      await accountExists(db, email),
      null,
      "OTP expirado não pode criar auth.user",
    );

    const signInResponse = await signIn(page, email);
    assert.ok(
      signInResponse.status >= 400 && signInResponse.status < 500,
      `cadastro não promovido deveria falhar login, recebeu ${signInResponse.status}`,
    );

    console.log("[auth-token-expiry-e2e] expiração de OTP falhou fechada.");
  } finally {
    await context.close();
  }
} finally {
  await db.end();
  await browser.close();
}
