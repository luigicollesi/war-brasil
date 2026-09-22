import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("P1: read-only auth uses signed cookie cache while mutations keep strong sessions", () => {
  const guard = read("src/lib/server/auth/auth-guard.ts");
  const titles = read("src/app/api/profile/titles/route.ts");
  const loadout = read("src/app/api/economy/loadout/route.ts");
  const purchases = read("src/app/api/economy/purchases/route.ts");
  const ticket = read("src/app/api/profile/realtime-ticket/route.ts");

  assert.match(
    guard,
    /getAuthenticatedSession[\s\S]*disableCookieCache: true/,
  );
  assert.match(guard, /getAuthenticatedSessionForRead/);
  assert.match(titles, /getAuthenticatedSessionForRead\(request\)/);
  assert.match(titles, /requireProfileMutationActor\(request\)/);
  assert.match(loadout, /getAuthenticatedSessionForRead\(request\)/);
  assert.match(loadout, /getAuthenticatedSession\(request\)/);
  assert.match(purchases, /getAuthenticatedSession\(request\)/);
  assert.match(ticket, /getAuthenticatedSession\(request\)/);
});

test("P1: storefront reads avoid a long transaction and loadout avoids full catalog", () => {
  const service = read("src/lib/server/economy/economy-service.ts");
  const repository = read("src/lib/server/economy/economy-repository.ts");
  const loadoutRoute = read("src/app/api/economy/loadout/route.ts");

  const storefrontStart = service.indexOf(
    "export async function getEconomyStorefront",
  );
  const storefrontEnd = service.indexOf(
    "export function parseEquipCosmeticInput",
    storefrontStart,
  );
  const storefront = service.slice(storefrontStart, storefrontEnd);

  assert.match(repository, /export async function isEconomyStateInitialized/);
  assert.match(service, /ensureEconomyStateForRead/);
  assert.match(service, /export async function getEconomyLoadout/);
  assert.match(storefront, /const userOverlayPromise = Promise\.all/);
  assert.match(storefront, /const catalogPromise = Promise\.all/);
  assert.match(
    storefront,
    /await Promise\.all\(\[userOverlayPromise, catalogPromise\]\)/,
  );
  assert.doesNotMatch(storefront, /query\("BEGIN"\)|query\("COMMIT"\)/);
  assert.match(loadoutRoute, /getEconomyLoadout\(session\.user\.id\)/);
  assert.doesNotMatch(loadoutRoute, /getEconomyStorefront/);
});

test("P1: best-effort post-commit effects use Cloudflare waitUntil with Node fallback", () => {
  const adapter = read("src/lib/server/cloudflare/post-response-task.ts");
  const command = read("src/lib/server/game-command.ts");
  const lobby = read(
    "src/lib/server/realtime/lobby-realtime-publisher.ts",
  );
  const notifications = read(
    "src/lib/server/realtime/user-notification-publisher.ts",
  );

  assert.match(adapter, /getCloudflareContext/);
  assert.match(adapter, /ctx\.waitUntil/);
  assert.match(adapter, /await task\(\)/);
  assert.match(
    command,
    /await client\.query\("COMMIT"\)[\s\S]*runPostResponseTask/,
  );
  assert.match(command, /publishCommittedGameChange/);
  assert.match(lobby, /runPostResponseTask\("lobby\.realtime"/);
  assert.match(
    notifications,
    /runPostResponseTask\("user\.notification\.realtime"/,
  );
});

test("P1: automation Queue is an optional fast path over canonical PostgreSQL schedules", () => {
  const producer = read(
    "src/lib/server/automation/game-automation-queue.ts",
  );
  const command = read("src/lib/server/game-command.ts");
  const schedule = read(
    "src/lib/server/automation/game-automation-schedule.ts",
  );
  const poller = read("worker/server.mjs");
  const consumer = read("worker/cloudflare/automation-queue.ts");
  const config = read("wrangler.automation.jsonc");
  const mainWrangler = read("wrangler.jsonc");

  assert.match(producer, /GAME_AUTOMATION_QUEUE/);
  assert.match(producer, /expectedRevision: input\.revision/);
  assert.match(producer, /delaySeconds: queueDelaySeconds/);
  assert.match(
    command,
    /runPostResponseTask\("game\.automation\.queue"[\s\S]*enqueueGameAutomationSchedule/,
  );
  assert.match(schedule, /automation_due_at=\$2/);
  assert.match(schedule, /automation_kind=\$3/);
  assert.match(poller, /CLAIM_DUE_AUTOMATION_SQL/);
  assert.match(consumer, /GAME_APP_SERVICE/);
  assert.match(consumer, /message\.ack\(\)/);
  assert.match(consumer, /message\.retry/);
  assert.match(consumer, /expectedRevision/);
  assert.match(config, /"queue": "war-brasil-automation"/);
  assert.match(config, /"dead_letter_queue": "war-brasil-automation-dlq"/);
  assert.match(config, /"binding": "GAME_APP_SERVICE"/);
  assert.doesNotMatch(mainWrangler, /GAME_AUTOMATION_QUEUE/);
});
