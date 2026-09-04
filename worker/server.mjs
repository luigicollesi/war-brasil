import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import pg from "pg";
import { advanceDueAutomation } from "./advance-client.mjs";
import {
  automationWorkerBatchSize,
  automationWorkerInternalBaseUrl,
  automationWorkerMode,
  automationWorkerPollMs,
  automationWorkerToken,
} from "./config.mjs";
import { recordAutomationWorkerMetric } from "./metrics.mjs";
import { DUE_AUTOMATION_SQL } from "./queries.mjs";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) loadEnvFile(envFile);
}

const mode = automationWorkerMode();

if (mode === "off") {
  recordAutomationWorkerMetric("disabled", { mode });
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL é obrigatória para o automation worker.");
}

const internalBaseUrl = automationWorkerInternalBaseUrl();
const workerToken = automationWorkerToken();
if (mode === "active" && (!internalBaseUrl || !workerToken)) {
  throw new Error(
    "Modo active exige GAME_AUTOMATION_INTERNAL_BASE_URL e GAME_AUTOMATION_WORKER_TOKEN.",
  );
}

const { Pool } = pg;
const pool = new Pool({
  connectionString,
  max: 2,
});
const pollMs = automationWorkerPollMs();
const batchSize = automationWorkerBatchSize();
const observedSchedules = new Map();
let timer = null;
let stopping = false;

function scheduleKey(row) {
  const dueAt =
    row.automation_due_at instanceof Date
      ? row.automation_due_at.toISOString()
      : String(row.automation_due_at);
  return `${row.revision}:${row.automation_kind}:${dueAt}`;
}

function dueAtValue(row) {
  return row.automation_due_at instanceof Date
    ? row.automation_due_at.toISOString()
    : row.automation_due_at;
}

async function executeActiveRow(row) {
  const startedAt = Date.now();
  const result = await advanceDueAutomation({
    row,
    baseUrl: internalBaseUrl,
    token: workerToken,
  });

  recordAutomationWorkerMetric(
    result.changed ? "active.executed" : "active.noop",
    {
      roomId: row.room_id,
      expectedRevision: row.revision,
      revision: result.revision,
      actionKind: result.kind,
      kind: row.automation_kind,
      dueAt: dueAtValue(row),
      dueLagMs: Number(row.due_lag_ms) || 0,
      durationMs: Date.now() - startedAt,
    },
  );
}

async function scan() {
  const startedAt = Date.now();
  const result = await pool.query(DUE_AUTOMATION_SQL, [batchSize]);
  const activeRooms = new Set();
  let maxLagMs = 0;

  for (const row of result.rows) {
    activeRooms.add(row.room_id);
    const lagMs = Number(row.due_lag_ms) || 0;
    maxLagMs = Math.max(maxLagMs, lagMs);
    const key = scheduleKey(row);

    if (mode === "shadow") {
      if (observedSchedules.get(row.room_id) === key) continue;
      observedSchedules.set(row.room_id, key);
      recordAutomationWorkerMetric("shadow.due", {
        roomId: row.room_id,
        revision: row.revision,
        kind: row.automation_kind,
        dueAt: dueAtValue(row),
        dueLagMs: lagMs,
      });
      continue;
    }

    try {
      await executeActiveRow(row);
    } catch (error) {
      recordAutomationWorkerMetric("active.failure", {
        roomId: row.room_id,
        revision: row.revision,
        kind: row.automation_kind,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const roomId of observedSchedules.keys()) {
    if (!activeRooms.has(roomId)) observedSchedules.delete(roomId);
  }

  recordAutomationWorkerMetric(`${mode}.scan`, {
    queueDepth: result.rowCount ?? result.rows.length,
    maxDueLagMs: maxLagMs,
    durationMs: Date.now() - startedAt,
    batchSize,
  });
}

async function tick() {
  if (stopping) return;
  try {
    await scan();
  } catch (error) {
    recordAutomationWorkerMetric(`${mode}.failure`, {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (!stopping) timer = setTimeout(tick, pollMs);
  }
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  if (timer) clearTimeout(timer);
  recordAutomationWorkerMetric("stopping", { signal });
  await pool.end().catch(() => undefined);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

recordAutomationWorkerMetric("started", {
  mode,
  pollMs,
  batchSize,
});
void tick();
