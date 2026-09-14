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
const PRESENCE_INTERNAL_URL =
  process.env.GAME_REALTIME_INTERNAL_URL?.trim().replace(/\/$/, "") || null;
const PRESENCE_INTERNAL_TOKEN =
  process.env.GAME_REALTIME_INTERNAL_TOKEN?.trim() || null;
const PRESENCE_E2E_REQUIRED = process.env.PROFILE_PRESENCE_E2E_REQUIRED === "1";
const FORGED_PRESENCE_USER_ID = "44444444-4444-4444-8444-444444444444";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatória para o E2E de verification.");
}
if (!EMAIL_SINK_DIR) {
  throw new Error("AUTH_EMAIL_SINK_DIR é obrigatória para o E2E de verification.");
}
if (PRESENCE_E2E_REQUIRED && (!PRESENCE_INTERNAL_URL || !PRESENCE_INTERNAL_TOKEN)) {
  throw new Error(
    "GAME_REALTIME_INTERNAL_URL/TOKEN são obrigatórias quando PROFILE_PRESENCE_E2E_REQUIRED=1.",
  );
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

async function internalPresence(userIds) {
  if (!PRESENCE_INTERNAL_URL || !PRESENCE_INTERNAL_TOKEN) return null;

  const response = await fetch(`${PRESENCE_INTERNAL_URL}/internal/presence/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PRESENCE_INTERNAL_TOKEN}`,
    },
    body: JSON.stringify({ userIds }),
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body?.availability, "available", JSON.stringify(body));
  assert.ok(Array.isArray(body?.presences), JSON.stringify(body));
  return body;
}

function presenceFor(batch, userId) {
  return batch?.presences?.find((entry) => entry?.userId === userId) ?? null;
}

async function assertSessionBoundPresence(page, session) {
  if (!PRESENCE_INTERNAL_URL || !PRESENCE_INTERNAL_TOKEN) return;

  const sessionUserId = session?.user?.id;
  assert.equal(typeof sessionUserId, "string", "sessão autenticada sem user.id");

  const before = await internalPresence([FORGED_PRESENCE_USER_ID]);
  assert.equal(
    presenceFor(before, FORGED_PRESENCE_USER_ID)?.state,
    "offline",
    "identidade forjada deve começar offline",
  );

  const heartbeat = await apiJson(page, "/api/profile/presence/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: FORGED_PRESENCE_USER_ID }),
  });
  assert.equal(heartbeat.status, 200, JSON.stringify(heartbeat.body));
  assert.equal(heartbeat.body?.state, "online", JSON.stringify(heartbeat.body));

  const after = await internalPresence([
    sessionUserId,
    FORGED_PRESENCE_USER_ID,
  ]);
  assert.equal(
    presenceFor(after, sessionUserId)?.state,
    "online",
    "heartbeat deve renovar somente a identidade autenticada",
  );
  assert.equal(
    presenceFor(after, FORGED_PRESENCE_USER_ID)?.state,
    "offline",
    "userId forjado no payload não pode receber presença",
  );
}

async function assertOwnedTitleBoundary(page, db, session, identity) {
  const userId = session?.user?.id;
  assert.equal(typeof userId, "string", "sessão autenticada sem user.id");

  const handle = `title-${identity}`.slice(0, 32);
  const ownedTitleId = `e2e-owned-${identity}`;
  const foreignTitleId = `e2e-foreign-${identity}`;

  await db.query(
    `INSERT INTO profile.commanders(user_id,handle,display_name)
     VALUES($1::uuid,$2,$3)
     ON CONFLICT (user_id) DO UPDATE
       SET handle=COALESCE(profile.commanders.handle,EXCLUDED.handle),
           display_name=COALESCE(profile.commanders.display_name,EXCLUDED.display_name)`,
    [userId, handle, "Title E2E Commander"],
  );
  await db.query(
    `INSERT INTO catalog.commander_titles(id,name,rarity,is_active)
     VALUES($1,'Owned E2E Title','rare',TRUE),($2,'Foreign E2E Title','epic',TRUE)`,
    [ownedTitleId, foreignTitleId],
  );
  await db.query(
    `INSERT INTO profile.commander_titles(user_id,title_id)
     VALUES($1::uuid,$2)`,
    [userId, ownedTitleId],
  );

  const available = await apiJson(page, "/api/profile/titles");
  assert.equal(available.status, 200, JSON.stringify(available.body));
  assert.equal(
    available.body?.titles?.some((title) => title?.id === ownedTitleId),
    true,
    "título desbloqueado deve aparecer no inventário autenticado",
  );
  assert.equal(
    available.body?.titles?.some((title) => title?.id === foreignTitleId),
    false,
    "título não possuído não pode aparecer no inventário autenticado",
  );

  const rejected = await apiJson(page, "/api/profile/titles", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titleId: foreignTitleId }),
  });
  assert.equal(rejected.status, 409, JSON.stringify(rejected.body));
  assert.equal(rejected.body?.error, "TITLE_NOT_OWNED_OR_INACTIVE");

  const beforeEquip = await db.query(
    `SELECT equipped_title_id FROM profile.commanders WHERE user_id=$1::uuid`,
    [userId],
  );
  assert.equal(beforeEquip.rows[0]?.equipped_title_id ?? null, null);

  const equipped = await apiJson(page, "/api/profile/titles", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titleId: ownedTitleId }),
  });
  assert.equal(equipped.status, 200, JSON.stringify(equipped.body));

  const afterEquip = await db.query(
    `SELECT equipped_title_id FROM profile.commanders WHERE user_id=$1::uuid`,
    [userId],
  );
  assert.equal(afterEquip.rows[0]?.equipped_title_id, ownedTitleId);

  const cleared = await apiJson(page, "/api/profile/titles", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titleId: null }),
  });
  assert.equal(cleared.status, 200, JSON.stringify(cleared.body));

  const afterClear = await db.query(
    `SELECT equipped_title_id FROM profile.commanders WHERE user_id=$1::uuid`,
    [userId],
  );
  assert.equal(afterClear.rows[0]?.equipped_title_id ?? null, null);
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
    const authenticatedSession = await getSession(page);
    assert.ok(authenticatedSession?.user, "login pós-verification não criou sessão");

    await assertSessionBoundPresence(page, authenticatedSession);
    await assertOwnedTitleBoundary(page, db, authenticatedSession, identity);

    console.log(
      "[auth-verification-e2e] signup sem sessão, link real, replay, token inválido, login pós-verification, presença vinculada à sessão e títulos cosméticos por ownership confirmados.",
    );
  } finally {
    await context.close();
  }
} finally {
  await db.end();
  await browser.close();
}

// Este arquivo é o entrypoint de credentials usado pelo CI. Mantemos reset e
// sessão no mesmo gate para exercitar o lifecycle completo antes dos limites/assentos.
await import("./auth-password-reset-e2e.mjs");
await import("./auth-session-security-e2e.mjs");
