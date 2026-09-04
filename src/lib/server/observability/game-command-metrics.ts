import "server-only";

import { channel } from "node:diagnostics_channel";

export const GAME_COMMAND_METRICS_CHANNEL = "war-brasil.game.command";

export type GameCommandMetricName =
  | "receipt.created"
  | "receipt.replayed"
  | "receipt.conflict"
  | "revision.stale";

type GameCommandMetric = {
  name: GameCommandMetricName;
  roomId: string;
  commandName: string;
  expectedRevision: number;
  revision?: number;
};

const metricsChannel = channel(GAME_COMMAND_METRICS_CHANNEL);

export function publishGameCommandMetric(metric: GameCommandMetric) {
  if (!metricsChannel.hasSubscribers) return;
  metricsChannel.publish(metric);
}
