import "server-only";

import { channel } from "node:diagnostics_channel";
import { performance } from "node:perf_hooks";

export const GAME_OPERATION_METRICS_CHANNEL = "war-brasil.game.operation";

type GameOperationName =
  | "game.query"
  | "game.command"
  | "game.conditional_command";

type GameOperationOutcome = "success" | "error";

export type DatabasePoolStats = {
  total: number;
  idle: number;
  waiting: number;
};

type GameOperationMetric = {
  name: GameOperationName;
  outcome: GameOperationOutcome;
  durationMs: number;
  pool: DatabasePoolStats;
};

type FinishGameOperationMetric = (
  outcome: GameOperationOutcome,
  pool: DatabasePoolStats,
) => void;

const metricsChannel = channel(GAME_OPERATION_METRICS_CHANNEL);

export function startGameOperationMetric(
  name: GameOperationName,
): FinishGameOperationMetric {
  if (!metricsChannel.hasSubscribers) {
    return () => undefined;
  }

  const startedAt = performance.now();
  return (outcome, pool) => {
    const metric: GameOperationMetric = {
      name,
      outcome,
      durationMs: performance.now() - startedAt,
      pool,
    };
    metricsChannel.publish(metric);
  };
}
