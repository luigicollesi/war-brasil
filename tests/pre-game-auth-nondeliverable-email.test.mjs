import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auth = readFileSync("src/lib/server/auth/auth.ts", "utf8");
const email = readFileSync("src/lib/server/auth/email.ts", "utf8");

test("fallback social sem email usa somente domínio reservado .invalid", () => {
  assert.match(auth, /@discord\.placeholder\.invalid/);
  assert.doesNotMatch(auth, /@apple\.placeholder\.invalid/);
});

test("boundary de email rejeita qualquer domínio .invalid antes do transportador", () => {
  assert.match(email, /export function isNonDeliverableAuthAddress/);
  assert.match(email, /domain === "invalid" \|\| domain\.endsWith\("\.invalid"\)/);
  assert.match(
    email,
    /export async function sendAuthEmail[\s\S]*isNonDeliverableAuthAddress\(message\.to\)[\s\S]*return;/,
  );
  assert.match(
    email,
    /export function dispatchAuthEmail[\s\S]*isNonDeliverableAuthAddress\(message\.to\)[\s\S]*return;/,
  );
});

test("produção envia email por transport HTTP com timeout e idempotência", () => {
  assert.match(email, /https:\/\/api\.resend\.com\/emails/);
  assert.match(email, /EMAIL_TRANSPORT_SECRET/);
  assert.match(email, /AUTH_EMAIL_FROM/);
  assert.match(email, /Idempotency-Key/);
  assert.match(email, /AbortController/);
  assert.match(email, /EMAIL_DELIVERY_TIMEOUT_MS = 8_000/);
  assert.match(email, /await deliverWithResend\(message\)/);
});

test("dispatch usa Next after para sobreviver ao fim da resposta sem bloquear auth", () => {
  assert.match(email, /import \{ after \} from "next\/server"/);
  assert.match(
    email,
    /export function dispatchAuthEmail[\s\S]*after\(async \(\) => \{[\s\S]*await sendAuthEmail\(message\)/,
  );
});

test("logs de email não incluem destinatário, token ou URL", () => {
  assert.doesNotMatch(email, /console\.(?:log|info|error)[^\n]*(?:message\.to|\burl\b|token)/i);
  assert.match(email, /delivery=sink subject=/);
  assert.match(email, /delivery=failed reason=/);
});
