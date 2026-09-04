import assert from "node:assert/strict";
import test from "node:test";
import {
  automationWorkerBatchSize,
  automationWorkerConcurrency,
  automationWorkerInternalBaseUrl,
  automationWorkerLeaseMs,
  automationWorkerMode,
  automationWorkerPollMs,
  automationWorkerToken,
} from "../config.mjs";

test("worker começa desligado e reserva shadow/active", () => {
  assert.equal(automationWorkerMode({}), "off");
  assert.equal(
    automationWorkerMode({ GAME_AUTOMATION_WORKER_MODE: "shadow" }),
    "shadow",
  );
  assert.equal(
    automationWorkerMode({ GAME_AUTOMATION_WORKER_MODE: "active" }),
    "active",
  );
  assert.throws(
    () => automationWorkerMode({ GAME_AUTOMATION_WORKER_MODE: "invalid" }),
    /inválido/,
  );
});

test("worker aplica limites seguros para intervalo, batch, concorrência e lease", () => {
  assert.equal(automationWorkerPollMs({}), 500);
  assert.equal(
    automationWorkerPollMs({ GAME_AUTOMATION_WORKER_POLL_MS: "100" }),
    100,
  );
  assert.equal(
    automationWorkerPollMs({ GAME_AUTOMATION_WORKER_POLL_MS: "10" }),
    500,
  );

  assert.equal(automationWorkerBatchSize({}), 50);
  assert.equal(
    automationWorkerBatchSize({ GAME_AUTOMATION_WORKER_BATCH_SIZE: "100" }),
    100,
  );
  assert.equal(
    automationWorkerBatchSize({ GAME_AUTOMATION_WORKER_BATCH_SIZE: "1000" }),
    50,
  );

  assert.equal(automationWorkerConcurrency({}), 4);
  assert.equal(
    automationWorkerConcurrency({ GAME_AUTOMATION_WORKER_CONCURRENCY: "8" }),
    8,
  );
  assert.equal(
    automationWorkerConcurrency({ GAME_AUTOMATION_WORKER_CONCURRENCY: "64" }),
    4,
  );

  assert.equal(automationWorkerLeaseMs({}), 10_000);
  assert.equal(
    automationWorkerLeaseMs({ GAME_AUTOMATION_WORKER_LEASE_MS: "30000" }),
    30_000,
  );
  assert.equal(
    automationWorkerLeaseMs({ GAME_AUTOMATION_WORKER_LEASE_MS: "500" }),
    10_000,
  );
});

test("modo active aceita somente endpoint HTTP(S) e token explícitos", () => {
  assert.equal(automationWorkerInternalBaseUrl({}), null);
  assert.equal(automationWorkerToken({}), null);
  assert.equal(
    automationWorkerInternalBaseUrl({
      GAME_AUTOMATION_INTERNAL_BASE_URL: "https://war.example.com/",
    }),
    "https://war.example.com",
  );
  assert.equal(
    automationWorkerToken({ GAME_AUTOMATION_WORKER_TOKEN: " secret " }),
    "secret",
  );
  assert.throws(
    () =>
      automationWorkerInternalBaseUrl({
        GAME_AUTOMATION_INTERNAL_BASE_URL: "ftp://war.example.com",
      }),
    /HTTP ou HTTPS/,
  );
});
