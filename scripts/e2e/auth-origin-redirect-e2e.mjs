import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightRuntimeDir = path.resolve(
  process.env.PLAYWRIGHT_RUNTIME_DIR ?? ".e2e-runtime/node_modules/playwright",
);
const playwright = await import(
  pathToFileURL(path.join(playwrightRuntimeDir, "index.mjs")).href
);

const BASE_URL = process.env.LOBBY_E2E_BASE_URL ?? "http://localhost:3000";
const PASSWORD = "WarBrasil-Origin-E2E-2026!";
const EVIL_ORIGIN = "https://attacker.example";

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

function assertRejected(response, label) {
  assert.ok(
    response.status >= 400 && response.status < 500,
    `${label} deveria ser rejeitado com 4xx, recebeu ${response.status}`,
  );
}

async function externalOriginPost(pathname, body) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: EVIL_ORIGIN,
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });

  return {
    status: response.status,
    location: response.headers.get("location"),
  };
}

const browser = await playwright.chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": "198.51.100.244" },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    const identity = `${process.pid}-${Date.now()}`;
    const email = `origin-${identity}@e2e.war-brasil.test`;

    const forgedRegistration = await externalOriginPost("/api/auth/register", {
      email: `forged-${identity}@e2e.war-brasil.test`,
      password: PASSWORD,
      termsAccepted: true,
    });
    assertRejected(forgedRegistration, "Origin externo em cadastro");
    assert.equal(forgedRegistration.location, null);

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

    const forgedResend = await externalOriginPost("/api/auth/register/resend", {
      email,
    });
    assertRejected(forgedResend, "Origin externo em resend");
    assert.equal(forgedResend.location, null);

    const forgedVerification = await externalOriginPost(
      "/api/auth/register/verify",
      { email, code: "000000" },
    );
    assertRejected(forgedVerification, "Origin externo em confirmação OTP");
    assert.equal(forgedVerification.location, null);

    const externalResetRedirect = await apiJson(
      page,
      "/api/auth/request-password-reset",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          redirectTo: `${EVIL_ORIGIN}/reset-complete`,
        }),
      },
    );
    assertRejected(externalResetRedirect, "redirect externo de password reset");

    const forgedOriginReset = await externalOriginPost(
      "/api/auth/request-password-reset",
      {
        email,
        redirectTo: "/?auth=reset-password",
      },
    );
    assertRejected(forgedOriginReset, "Origin externo em password reset");
    assert.equal(forgedOriginReset.location, null);

    console.log(
      "[auth-origin-redirect-e2e] cadastro, OTP mutations e redirects externos foram rejeitados.",
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
