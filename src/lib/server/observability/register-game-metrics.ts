import "server-only";

import { channel } from "node:diagnostics_channel";
import {
  GAME_COMMAND_METRICS_CHANNEL,
  type GameCommandMetric,
} from "./game-command-metrics";
import {
  GAME_OPERATION_METRICS_CHANNEL,
  type GameOperationMetric,
} from "./game-operation-metrics";

const globalForMetrics = globalThis as typeof globalThis & {
  warBrasilGameMetricsRegistered?: boolean;
};

function configuredSampleRate() {
  const raw = Number(process.env.GAME_METRICS_SAMPLE_RATE);
  if (Number.isFinite(raw)) return Math.max(0, Math.min(1, raw));
  return process.env.NODE_ENV === "production" ? 0.1 : 1;
}

function sampled(rate: number) {
  return rate >= 1 || (rate > 0 && Math.random() < rate);
}

function logMetric(
  source: string,
  metric: GameOperationMetric | GameCommandMetric,
) {
  console.info(
    JSON.stringify({
      source,
      region:
        process.env.VERCEL_REGION ??
        process.env.CF_REGION ??
        process.env.AWS_REGION ??
        null,
      ...metric,
    }),
  );
}

if (!globalForMetrics.warBrasilGameMetricsRegistered) {
  globalForMetrics.warBrasilGameMetricsRegistered = true;
  const sampleRate = configuredSampleRate();

  channel(GAME_OPERATION_METRICS_CHANNEL).subscribe((message) => {
    const metric = message as GameOperationMetric;
    if (metric.outcome === "error" || sampled(sampleRate)) {
      logMetric(GAME_OPERATION_METRICS_CHANNEL, metric);
    }
  });

  channel(GAME_COMMAND_METRICS_CHANNEL).subscribe((message) => {
    const metric = message as GameCommandMetric;
    if (metric.name !== "receipt.created" || sampled(sampleRate)) {
      logMetric(GAME_COMMAND_METRICS_CHANNEL, metric);
    }
  });
}
