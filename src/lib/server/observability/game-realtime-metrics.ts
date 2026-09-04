import "server-only";

import { channel } from "node:diagnostics_channel";

export const GAME_REALTIME_METRICS_CHANNEL = "war-brasil.game.realtime";

type GameRealtimeMetricName =
  | "notify.publish"
  | "notify.private"
  | "notify.patch"
  | "notify.patch_fallback"
  | "notify.failure";

type GameRealtimeMetric = {
  name: GameRealtimeMetricName;
  roomId: string;
  revision: number;
  error?: string;
  payloadBytes?: number;
};

const metricsChannel = channel(GAME_REALTIME_METRICS_CHANNEL);

export function publishGameRealtimeMetric(metric: GameRealtimeMetric) {
  if (!metricsChannel.hasSubscribers) return;
  metricsChannel.publish(metric);
}
