import assert from "node:assert/strict";
import { Client } from "pg";
import { apiJson, loadPlaywrightRuntime } from "./runtime-helper.mjs";
import { waitForRegistrationCode } from "./registration-otp-helper.mjs";
import { completeCommanderAgeGate } from "./command-access-helper.mjs";

const playwright = await loadPlaywrightRuntime();

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

async function userVerificationState(db, email) {
  const result = await db.query(
    `SELECT "emailVerified" AS verified
       FROM auth."user"
      WHERE email = $1`,
    [email],
  );
  if (!result.rowCount) return null;
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
  return { handle };
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

    const invalidEmail = `invalid-${identity}@e2e.war-brasil.test`;
    await register(page, invalidEmail);
    const invalidCode = await waitForRegistrationCode(
      invalidEmail,
      EMAIL_SINK_DIR,
    );
    assert.equal(
      await userVerificationState(db, invalidEmail),
      null,
      "cadastro pendente não pode criar auth.user",
    );
    const wrongCode = invalidCode === "000000" ? "999999" : "000000";
    const invalidVerification = await apiJson(
      page,
      "/api/auth/register/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invalidEmail, code: wrongCode }),
      },
    );
    assert.equal(invalidVerification.status, 400, JSON.stringify(invalidVerification.body));
    assert.equal(
      await userVerificationState(db, invalidEmail),
      null,
      "OTP inválido não pode promover cadastro",
    );
    assert.equal(
      (await getSession(page))?.user ?? null,
      null,
      "OTP inválido não pode criar sessão",
    );

    const verifiedEmail = `verify-${identity}@e2e.war-brasil.test`;
    await register(page, verifiedEmail);

    assert.equal(
      await userVerificationState(db, verifiedEmail),
      null,
      "signup credentials deve existir apenas em pending_registration",
    );
    assert.equal(
      (await getSession(page))?.user ?? null,
      null,
      "signup pendente não pode criar sessão",
    );

    const verificationCode = await waitForRegistrationCode(
      verifiedEmail,
      EMAIL_SINK_DIR,
    );
    const verification = await apiJson(page, "/api/auth/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: verifiedEmail, code: verificationCode }),
    });
    assert.equal(verification.status, 200, JSON.stringify(verification.body));
    assert.equal(verification.body?.authenticated, true);
    assert.equal(
      await userVerificationState(db, verifiedEmail),
      true,
      "OTP válido deve criar auth.user já verificado",
    );

    const authenticatedSession = await getSession(page);
    assert.ok(
      authenticatedSession?.user,
      "confirmação OTP deve criar sessão imediatamente",
    );

    const replay = await apiJson(page, "/api/auth/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: verifiedEmail, code: verificationCode }),
    });
    assert.notEqual(replay.status, 200, "OTP consumido não pode ser reutilizado");
    assert.equal(
      await userVerificationState(db, verifiedEmail),
      true,
      "replay não pode regredir conta já confirmada",
    );

    await assertSessionBoundPresence(page, authenticatedSession);
    await completeCommanderAgeGate(page);
    await assertOwnedTitleBoundary(
      page,
      db,
      authenticatedSession,
      identity,
    );

    console.log(
      "[auth-verification-e2e] pending signup sem auth.user, OTP, sessão imediata, age gate, presença e títulos confirmados.",
    );
  } finally {
    await context.close();
  }
} finally {
  await db.end();
  await browser.close();
}

