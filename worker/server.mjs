import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { hostname } from "node:os";
import { loadEnvFile } from "node:process";
import pg from "pg";
import { advanceDueAutomation } from "./advance-client.mjs";
import {
  automationWorkerBatchSize,
  automationWorkerConcurrency,
  automationWorkerInternalBaseUrl,
  automationWorkerLeaseMs,
  automationWorkerMode,
  automationWorkerPollMs,
  automationWorkerToken,
} from "./config.mjs";
import { recordAutomationWorkerMetric } from "./metrics.mjs";
import {
  CLAIM_DUE_AUTOMATION_SQL,
  DUE_AUTOMATION_SQL,
  RELEASE_AUTOMATION_CLAIM_SQL,
} from "./queries.mjs";

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

const instanceId =
  process.env.GAME_AUTOMATION_WORKER_INSTANCE_ID?.trim() ||
  `${hostname()}:${process.pid}:${randomUUID()}`;
const concurrency = automationWorkerConcurrency();
const leaseMs = automationWorkerLeaseMs();
const { Pool } = pg;
const pool = new Pool({
  connectionString,
  max: Math.max(2, Math.min(16, concurrency + 1)),
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

async function releaseClaim(row) {
  const result = await pool.query(RELEASE_AUTOMATION_CLAIM_SQL, [
    row.room_id,
    instanceId,
  ]);
  recordAutomationWorkerMetric("claim.released", {
    roomId: row.room_id,
    released: (result.rowCount ?? 0) > 0,
  });
}

async function executeActiveRow(row) {
  const startedAt = Date.now();
  if (row.recovered_expired_claim === true) {
    recordAutomationWorkerMetric("claim.recovered", {
      roomId: row.room_id,
      revision: row.revision,
    });
  }

  try {
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

    await releaseClaim(row);
  } catch (error) {
    recordAutomationWorkerMetric("active.failure", {
      roomId: row.room_id,
      revision: row.revision,
      kind: row.automation_kind,
      error: error instanceof Error ? error.message : String(error),
      leaseExpiresAfterMs: leaseMs,
    });
    // Keep the lease after failure. Another worker may recover it after expiry.
  }
}

async function runWithConcurrency(rows, limit, handler) {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(limit, rows.length) },
    async () => {
      while (!stopping) {
        const index = cursor;
        cursor += 1;
        if (index >= rows.length) return;
        await handler(rows[index]);
      }
    },
  );
  await Promise.all(runners);
}

async function scanShadow() {
  const result = await pool.query(DUE_AUTOMATION_SQL, [batchSize]);
  const activeRooms = new Set();
  let maxLagMs = 0;

  for (const row of result.rows) {
    activeRooms.add(row.room_id);
    const lagMs = Number(row.due_lag_ms) || 0;
    maxLagMs = Math.max(maxLagMs, lagMs);
    const key = scheduleKey(row);
    if (observedSchedules.get(row.room_id) === key) continue;
    observedSchedules.set(row.room_id, key);
    recordAutomationWorkerMetric("shadow.due", {
      roomId: row.room_id,
      revision: row.revision,
      kind: row.automation_kind,
      dueAt: dueAtValue(row),
      dueLagMs: lagMs,
    });
  }

  for (const roomId of observedSchedules.keys()) {
    if (!activeRooms.has(roomId)) observedSchedules.delete(roomId);
  }

  return {
    queueDepth: result.rowCount ?? result.rows.length,
    maxLagMs,
  };
}

async function scanActive() {
  const result = await pool.query(CLAIM_DUE_AUTOMATION_SQL, [
    batchSize,
    instanceId,
    leaseMs,
  ]);
  let maxLagMs = 0;
  for (const row of result.rows) {
    maxLagMs = Math.max(maxLagMs, Number(row.due_lag_ms) || 0);
  }

  recordAutomationWorkerMetric("claim.batch", {
    claimed: result.rowCount ?? result.rows.length,
    batchSize,
    concurrency,
    leaseMs,
  });
  await runWithConcurrency(result.rows, concurrency, executeActiveRow);

  return {
    queueDepth: result.rowCount ?? result.rows.length,
    maxLagMs,
  };
}

async function scan() {
  const startedAt = Date.now();
  const result = mode === "shadow" ? await scanShadow() : await scanActive();

  recordAutomationWorkerMetric(`${mode}.scan`, {
    queueDepth: result.queueDepth,
    maxDueLagMs: result.maxLagMs,
    durationMs: Date.now() - startedAt,
    batchSize,
    concurrency: mode === "active" ? concurrency : 1,
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
  recordAutomationWorkerMetric("stopping", { signal, instanceId });
  await pool.end().catch(() => undefined);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

recordAutomationWorkerMetric("started", {
  mode,
  pollMs,
  batchSize,
  concurrency,
  leaseMs,
  instanceId,
});
void tick();
