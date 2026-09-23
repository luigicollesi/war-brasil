import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Next instrumentation subscribes to game diagnostics in Node runtime", () => {
  const instrumentation = readFileSync("src/instrumentation.ts", "utf8");
  const registry = readFileSync(
    "src/lib/server/observability/register-game-metrics.ts",
    "utf8",
  );
  const operation = readFileSync(
    "src/lib/server/observability/game-operation-metrics.ts",
    "utf8",
  );
  const command = readFileSync(
    "src/lib/server/observability/game-command-metrics.ts",
    "utf8",
  );

  assert.match(instrumentation, /NEXT_RUNTIME !== "nodejs"/);
  assert.match(instrumentation, /register-game-metrics/);
  assert.match(registry, /channel\(GAME_OPERATION_METRICS_CHANNEL\)\.subscribe/);
  assert.match(registry, /channel\(GAME_COMMAND_METRICS_CHANNEL\)\.subscribe/);
  assert.match(registry, /GAME_METRICS_SAMPLE_RATE/);
  assert.match(registry, /metric\.outcome === "error"/);
  assert.match(registry, /VERCEL_REGION/);
  assert.match(operation, /export type GameOperationMetric/);
  assert.match(command, /export type GameCommandMetric/);
});

test("Vercel compute is pinned to the Neon sa-east-1 region", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.deepEqual(config.regions, ["gru1"]);
});
