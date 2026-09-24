import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const scanner = readFileSync(
  "scripts/ci/assert-no-auth-secret-leaks.mjs",
  "utf8",
);
const workflow = readFileSync(".github/workflows/test.yml", "utf8");

test("leak scan cobre artefatos públicos e serializados sem escanear bundle server arbitrário", () => {
  assert.match(scanner, /\.next\/static/);
  assert.match(scanner, /\.next\/server\/app/);
  assert.match(scanner, /\.next\/server\/pages/);
  assert.match(scanner, /SERIALIZED_EXTENSIONS/);
  assert.match(scanner, /\.html/);
  assert.match(scanner, /\.rsc/);
  assert.match(scanner, /\.map/);
});

test("CI injeta sentinels falsos para banco, auth, OAuth, email e Turnstile", () => {
  for (const name of [
    "DB_PASSWORD_SENTINEL",
    "BETTER_AUTH_SECRET",
    "GOOGLE_CLIENT_SECRET",
    "DISCORD_CLIENT_SECRET",
    "EMAIL_TRANSPORT_SECRET",
    "TURNSTILE_SECRET_KEY",
  ]) {
    assert.match(workflow, new RegExp(`${name}:`), name);
  }
  assert.doesNotMatch(workflow, /APPLE_/);
  assert.match(workflow, /assert-no-auth-secret-leaks\.mjs/);
  assert.match(scanner, /TURNSTILE_SECRET_KEY/);
});

test("scanner relata apenas label e caminho, nunca concatena valor secreto no erro", () => {
  assert.match(scanner, /leaks\.push\(\{ label, file:/);
  assert.match(scanner, /\$\{label\} encontrado em \$\{file\}/);
  assert.doesNotMatch(scanner, /\$\{value\}/);
  assert.doesNotMatch(scanner, /console\.(?:log|error)[^\n]*value/);
});
