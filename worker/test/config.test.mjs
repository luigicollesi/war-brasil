import assert from "node:assert/strict";
import test from "node:test";
import {
  automationWorkerBatchSize,
  automationWorkerMode,
  automationWorkerPollMs,
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

test("worker aplica limites seguros para intervalo e batch", () => {
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
});
