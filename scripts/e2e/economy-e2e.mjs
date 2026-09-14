import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

const playwrightRuntimeDir = path.resolve(
  process.env.PLAYWRIGHT_RUNTIME_DIR ?? ".e2e-runtime/node_modules/playwright",
);
const playwright = await import(
  pathToFileURL(path.join(playwrightRuntimeDir, "index.mjs")).href,
);

const BASE_URL = process.env.LOBBY_E2E_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.LOBBY_E2E_DATABASE_URL ?? process.env.DATABASE_URL;
const ARTIFACT_DIR = path.resolve(
  process.env.ECONOMY_E2E_ARTIFACT_DIR ?? "test-results/economy-eval",
);

if (!DATABASE_URL) throw new Error("DATABASE_URL E2E é obrigatória.");
mkdirSync(ARTIFACT_DIR, { recursive: true });

assert.ok(playwright.chromium);
assert.ok(Client);
console.log(`[economy-e2e] scaffold ready for ${BASE_URL}`);
