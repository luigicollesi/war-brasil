import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("PROFILE V4 Arsenal keeps the private shell when Economy is unavailable", async () => {
  const page = await source("src/app/profile/arsenal/page.tsx");

  assert.match(page, /economyUnavailableReason/);
  assert.match(page, /available:\s*false/);
  assert.match(page, /<ProfileEconomyUnavailable/);
});

test("PROFILE V4 Intendência keeps the private shell when Economy is unavailable", async () => {
  const page = await source("src/app/profile/store/page.tsx");

  assert.match(page, /economyUnavailableReason/);
  assert.match(page, /available:\s*false/);
  assert.match(page, /<ProfileEconomyUnavailable/);
});

test("economy failure UI does not synthesize money or expose internal errors", async () => {
  const unavailable = await source("src/components/profile/v4/profile-economy-unavailable.tsx");

  assert.match(unavailable, /temporariamente indisponível/i);
  assert.doesNotMatch(unavailable, /balance:\s*0/);
  assert.doesNotMatch(unavailable, /error\.message|stack|ECONOMY_/);
});
