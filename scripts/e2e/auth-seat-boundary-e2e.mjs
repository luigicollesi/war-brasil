import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { waitForRegistrationCode } from "./registration-otp-helper.mjs";
import { completeCommanderOnboarding } from "./command-access-helper.mjs";

const playwrightRuntimeDir = path.resolve(
  process.env.PLAYWRIGHT_RUNTIME_DIR ?? ".e2e-runtime/node_modules/playwright",
);
const playwright = await import(
  pathToFileURL(path.join(playwrightRuntimeDir, "index.mjs")).href
);

const BASE_URL = process.env.LOBBY_E2E_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.LOBBY_E2E_DATABASE_URL ?? process.env.DATABASE_URL;
const EMAIL_SINK_DIR = process.env.AUTH_EMAIL_SINK_DIR;
const PASSWORD = "WarBrasil-Seat-E2E-2026!";
const PLAYER_COOKIE = "war_brasil_player";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatória para o E2E account+seat.");
}
if (!EMAIL_SINK_DIR) {
  throw new Error("AUTH_EMAIL_SINK_DIR é obrigatória para o E2E account+seat.");
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

async function createAuthenticatedActor(browser, index) {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${index + 10}` },
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });

  const email = `seat-boundary-${process.pid}-${index}@e2e.war-brasil.test`;
  const registration = await apiJson(page, "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, termsAccepted: true }),
  });
  assert.equal(registration.status, 200, JSON.stringify(registration.body));

  const code = await waitForRegistrationCode(email, EMAIL_SINK_DIR);
  const verification = await apiJson(page, "/api/auth/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  assert.equal(verification.status, 200, JSON.stringify(verification.body));
  assert.equal(verification.body?.authenticated, true);

  await completeCommanderOnboarding(page, {
    handle: `seat_${process.pid}_${index}`,
    displayName: `Seat Boundary ${index}`,
  });

  return { context, page };
}

async function playerCookie(context) {
  const cookies = await context.cookies(BASE_URL);
  const cookie = cookies.find((candidate) => candidate.name === PLAYER_COOKIE);
  assert.ok(cookie?.value, "war_brasil_player ausente");
  return cookie;
}

const browser = await playwright.chromium.launch({ headless: true });

try {
  const accountA = await createAuthenticatedActor(browser, 1);
  const accountB = await createAuthenticatedActor(browser, 2);

  try {
    const created = await apiJson(accountA.page, "/api/rooms", { method: "POST" });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const roomCode = created.body?.room?.code;
    assert.match(roomCode ?? "", /^[A-Z0-9]{6}$/);

    const joined = await apiJson(accountB.page, "/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: roomCode }),
    });
    assert.equal(joined.status, 200, JSON.stringify(joined.body));

    const seatA = await playerCookie(accountA.context);
    const seatB = await playerCookie(accountB.context);

    await accountA.context.addCookies([
      {
        name: PLAYER_COOKIE,
        value: seatB.value,
        url: BASE_URL,
        httpOnly: seatB.httpOnly,
        secure: seatB.secure,
        sameSite: seatB.sameSite,
      },
    ]);

    const stolenSeat = await apiJson(accountA.page, `/api/rooms/${roomCode}`);
    assert.equal(
      stolenSeat.status,
      403,
      `conta A + seat B deveria ser proibido: ${JSON.stringify(stolenSeat.body)}`,
    );

    await accountA.context.addCookies([
      {
        name: PLAYER_COOKIE,
        value: seatA.value,
        url: BASE_URL,
        httpOnly: seatA.httpOnly,
        secure: seatA.secure,
        sameSite: seatA.sameSite,
      },
    ]);
    const restored = await apiJson(accountA.page, `/api/rooms/${roomCode}`);
    assert.equal(restored.status, 200, JSON.stringify(restored.body));

    const seatOnly = await browser.newContext();
    try {
      await seatOnly.addCookies([
        {
          name: PLAYER_COOKIE,
          value: seatB.value,
          url: BASE_URL,
          httpOnly: seatB.httpOnly,
          secure: seatB.secure,
          sameSite: seatB.sameSite,
        },
      ]);
      const page = await seatOnly.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
      const noAccount = await apiJson(page, `/api/rooms/${roomCode}`);
      assert.equal(
        noAccount.status,
        401,
        `seat sem conta deveria receber 401: ${JSON.stringify(noAccount.body)}`,
      );
    } finally {
      await seatOnly.close();
    }

    console.log(
      "[auth-seat-e2e] account+seat mismatch=403 e seat-only=401 confirmados.",
    );
  } finally {
    await accountA.context.close();
    await accountB.context.close();
  }
} finally {
  await browser.close();
}
