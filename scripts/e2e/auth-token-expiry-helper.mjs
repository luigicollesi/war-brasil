import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { withE2EAuthCaptcha } from "./runtime-helper.mjs";

export const PASSWORD = "WarBrasil-Expiry-E2E-2026!";
export const NEW_PASSWORD = "WarBrasil-Expiry-New-E2E-2026!";

export async function apiJson(page, url, init = {}) {
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

export async function register(page, email) {
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

export async function signIn(page, email, password = PASSWORD) {
  return apiJson(page, "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe: true }),
  });
}

export async function signOut(page) {
  return apiJson(page, "/api/auth/sign-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function waitForEmail(emailSinkDir, to, subject) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const entries = await readdir(emailSinkDir).catch(() => []);
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const raw = await readFile(path.join(emailSinkDir, entry), "utf8").catch(
        () => null,
      );
      if (!raw) continue;
      try {
        const message = JSON.parse(raw);
        if (message?.to === to && message?.subject === subject) return message;
      } catch {
        // O polling tenta novamente se coincidir com a escrita do sink.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`email E2E não capturado para subject=${subject}`);
}

export function actionUrl(message) {
  const match = String(message?.text ?? "").match(/https?:\/\/[^\s]+/);
  assert.ok(match?.[0], "email não contém URL de ação textual");
  return match[0];
}

export function tokenFromResetActionUrl(value) {
  const url = new URL(value);
  const queryToken = url.searchParams.get("token");
  if (queryToken) return queryToken;

  const segments = url.pathname.split("/").filter(Boolean);
  const resetIndex = segments.lastIndexOf("reset-password");
  const pathToken = resetIndex >= 0 ? segments[resetIndex + 1] : null;
  return pathToken ? decodeURIComponent(pathToken) : null;
}

export async function expireRegistrationCode(db, email) {
  const result = await db.query(
    `UPDATE auth.pending_registration
        SET code_expires_at = NOW() - INTERVAL '1 minute',
            updated_at = NOW()
      WHERE email = $1
      RETURNING id`,
    [email],
  );
  assert.equal(result.rowCount, 1, "cadastro pendente não localizado para expiração");
}

export async function expireResetToken(db, token) {
  const result = await db.query(
    `UPDATE auth.verification
        SET "expiresAt" = NOW() - INTERVAL '1 minute',
            "updatedAt" = NOW()
      WHERE identifier = $1
        AND "expiresAt" > NOW()
      RETURNING id`,
    [`reset-password:${token}`],
  );
  assert.equal(
    result.rowCount,
    1,
    "token de password reset não encontrou exatamente uma verification ativa",
  );
}

export async function accountExists(db, email) {
  const result = await db.query(
    `SELECT "emailVerified" AS verified
       FROM auth."user"
      WHERE email = $1`,
    [email],
  );
  return result.rows[0] ?? null;
}
