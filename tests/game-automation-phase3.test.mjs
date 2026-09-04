import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { scheduledBotActionType } from "../.test-build/bots/bot-schedule.js";
import { gameAutomationDriver } from "../.test-build/client/game-automation-driver.js";
import {
  battlePresentationDueAt,
  initialTerritoryPresentationDueAt,
  orderRollPresentationDueAt,
} from "../.test-build/game-transitions.js";

function source(path) {
  return readFileSync(path, "utf8");
}

test("agenda reutiliza exatamente os relógios de apresentação existentes", () => {
  const start = new Date("2026-09-04T00:00:00.000Z");
  assert.equal(
    initialTerritoryPresentationDueAt(start)?.toISOString(),
    "2026-09-04T00:00:06.200Z",
  );
  assert.equal(
    orderRollPresentationDueAt(true, start)?.toISOString(),
    "2026-09-04T00:00:02.000Z",
  );
  assert.equal(orderRollPresentationDueAt(false, start), null);
  assert.equal(
    battlePresentationDueAt("show_attacker_result", start)?.toISOString(),
    "2026-09-04T00:00:03.000Z",
  );
  assert.equal(
    battlePresentationDueAt("show_comparison", start)?.toISOString(),
    "2026-09-04T00:00:02.000Z",
  );
  assert.equal(battlePresentationDueAt("awaiting_attacker_roll", start), null);
});

test("agendamento de bot deriva somente do estado atual da partida", () => {
  assert.equal(
    scheduledBotActionType({
      status: "order_roll",
      phase: "cards",
      pendingFromTerritoryId: null,
      pendingToTerritoryId: null,
      battleStage: null,
    }),
    "roll_order",
  );
  assert.equal(
    scheduledBotActionType({
      status: "playing",
      phase: "attack",
      pendingFromTerritoryId: null,
      pendingToTerritoryId: null,
      battleStage: "awaiting_defender_roll",
    }),
    "roll_battle",
  );
  assert.equal(
    scheduledBotActionType({
      status: "playing",
      phase: "attack",
      pendingFromTerritoryId: 1,
      pendingToTerritoryId: 2,
      battleStage: null,
    }),
    "complete_conquest",
  );
  assert.equal(
    scheduledBotActionType({
      status: "finished",
      phase: "finished",
      pendingFromTerritoryId: null,
      pendingToTerritoryId: null,
      battleStage: null,
    }),
    null,
  );
});

test("migration cria agenda durável indexada sem transformar job em entidade de gameplay", () => {
  const migration = source("src/lib/db/migrations/018-game-automation-schedule.sql");
  assert.match(migration, /automation_due_at TIMESTAMPTZ/);
  assert.match(migration, /automation_kind VARCHAR\(20\)/);
  assert.match(migration, /'presentation', 'bot'/);
  assert.match(migration, /game_rooms_automation_due_idx/);
  assert.match(migration, /WHERE automation_due_at IS NOT NULL/);
});

test("command boundary reconcilia agenda dentro do lock antes da revision e do commit de mutação", () => {
  const command = source("src/lib/server/game-command.ts");
  const execute = command.indexOf("const value = await execute(client)");
  const reconcile = command.indexOf(
    "await reconcileGameAutomationSchedule(client, roomId)",
    execute,
  );
  const revision = command.indexOf(
    "await bumpGameRevision(client, roomId)",
    reconcile,
  );
  const commit = command.indexOf('await client.query("COMMIT")', revision);

  assert.ok(execute >= 0);
  assert.ok(reconcile > execute);
  assert.ok(revision > reconcile);
  assert.ok(commit > revision);
  assert.match(
    command,
    /const value = await execute\(client\)[\s\S]*reconcileGameAutomationSchedule/,
  );
});

test("scheduler persiste somente apresentação ou bot e limpa timers obsoletos", () => {
  const schedule = source(
    "src/lib/server/automation/game-automation-schedule.ts",
  );
  assert.match(schedule, /initialTerritoryPresentationDueAt/);
  assert.match(schedule, /orderRollPresentationDueAt/);
  assert.match(schedule, /battlePresentationDueAt/);
  assert.match(schedule, /requiredActorId/);
  assert.match(schedule, /pickBotDelayMs/);
  assert.match(schedule, /automation_due_at=\$2,automation_kind=\$3/);
  assert.match(schedule, /bot_next_action_at=NULL/);
  assert.doesNotMatch(schedule, /setTimeout|setInterval/);
});

test("worker shadow observa e active delega mutação ao command boundary versionado", () => {
  const worker = source("worker/server.mjs");
  const client = source("worker/advance-client.mjs");
  const query = source("worker/queries.mjs");
  const route = source("src/app/api/internal/automation/advance/route.ts");
  const auth = source("src/lib/server/automation/game-automation-worker-auth.ts");
  const shadowQuery = query.slice(
    query.indexOf("export const DUE_AUTOMATION_SQL"),
    query.indexOf("export const CLAIM_DUE_AUTOMATION_SQL"),
  );

  assert.match(worker, /mode === "shadow"/);
  assert.match(worker, /shadow\.due/);
  assert.match(worker, /executeActiveRow/);
  assert.match(worker, /active\.executed/);
  assert.match(worker, /scanShadow\(\)[\s\S]*pool\.query\(DUE_AUTOMATION_SQL/);
  assert.match(worker, /scanActive\(\)[\s\S]*pool\.query\(CLAIM_DUE_AUTOMATION_SQL/);
  assert.match(client, /expectedRevision: row\.revision/);
  assert.match(client, /Authorization: `Bearer \$\{token\}`/);
  assert.match(route, /advanceGameAutomationCommand/);
  assert.match(route, /expectedRevision/);
  assert.match(auth, /timingSafeEqual/);
  assert.doesNotMatch(worker, /UPDATE game_rooms|DELETE FROM/);
  assert.doesNotMatch(shadowQuery, /UPDATE|DELETE|FOR UPDATE/i);
  assert.match(query, /CLAIM_DUE_AUTOMATION_SQL[\s\S]*FOR UPDATE SKIP LOCKED/);
  assert.match(query, /CLAIM_DUE_AUTOMATION_SQL[\s\S]*UPDATE game_rooms room/);
});

test("driver de automação preserva browser como default e permite corte para server", () => {
  assert.equal(gameAutomationDriver(undefined), "browser");
  assert.equal(gameAutomationDriver("browser"), "browser");
  assert.equal(gameAutomationDriver("server"), "server");
  assert.equal(gameAutomationDriver("invalid"), "browser");

  const sync = source("src/hooks/use-game-sync.ts");
  assert.match(sync, /const automationDriver = gameAutomationDriver\(\)/);
  assert.match(sync, /automationDriver === "browser"/);
  assert.match(sync, /await advancePresentation\(\)/);
  assert.match(sync, /presentationPending: Boolean\([\s\S]*automationDriver === "browser"/);
});
