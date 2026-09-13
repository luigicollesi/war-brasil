import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auth = readFileSync("src/lib/server/auth/auth.ts", "utf8");
const email = readFileSync("src/lib/server/auth/email.ts", "utf8");

test("fallbacks sociais sem email usam somente domínio reservado .invalid", () => {
  assert.match(auth, /@discord\.placeholder\.invalid/);
  assert.match(auth, /@apple\.placeholder\.invalid/);
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

test("logs de email não incluem destinatário, token ou URL", () => {
  assert.doesNotMatch(email, /console\.(?:log|info|error)[^\n]*(?:message\.to|\burl\b|token)/i);
  assert.match(email, /delivery=sink subject=/);
  assert.match(email, /delivery=failed reason=/);
});
