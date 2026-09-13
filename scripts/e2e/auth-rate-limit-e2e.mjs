import assert from "node:assert/strict";
import { Client } from "pg";

const BASE_URL = process.env.LOBBY_E2E_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.LOBBY_E2E_DATABASE_URL ?? process.env.DATABASE_URL;
const TEST_IP = "198.51.100.250";
const MAX_ATTEMPTS = 8;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatória para o E2E de rate limit.");
}

let limitedAt = null;
let retryAfter = null;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const response = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE_URL,
      "x-forwarded-for": TEST_IP,
    },
    body: JSON.stringify({
      email: "rate-limit-probe@e2e.war-brasil.test",
      password: "Invalid-E2E-Password!",
      rememberMe: true,
    }),
  });

  if (response.status === 429) {
    limitedAt = attempt;
    retryAfter = response.headers.get("x-retry-after");
    break;
  }

  assert.ok(
    response.status >= 400 && response.status < 500,
    `tentativa ${attempt} deveria falhar como credencial inválida, recebeu ${response.status}`,
  );
}

assert.ok(limitedAt, `rate limit não respondeu 429 em ${MAX_ATTEMPTS} tentativas`);
assert.ok(limitedAt > 1, "primeira tentativa não pode nascer rate-limited");
assert.ok(retryAfter, "429 do Better Auth não expôs X-Retry-After");
assert.ok(Number(retryAfter) > 0, "X-Retry-After deve ser positivo");

const db = new Client({ connectionString: DATABASE_URL });
await db.connect();
try {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count FROM auth."rateLimit"`,
  );
  assert.ok(
    result.rows[0]?.count > 0,
    "limiter respondeu, mas não persistiu contador em auth.rateLimit",
  );
} finally {
  await db.end();
}

console.log(
  `[auth-rate-limit-e2e] 429 confirmado na tentativa ${limitedAt}; contador persistido.`,
);
