import { channel } from "node:diagnostics_channel";

export const GAME_REALTIME_METRICS_CHANNEL = "war-brasil.game.realtime";

const realtimeChannel = channel(GAME_REALTIME_METRICS_CHANNEL);

const counters = {
  connections: 0,
  disconnects: 0,
  authRejected: 0,
  broadcasts: 0,
  privateBroadcasts: 0,
  coalesced: 0,
  patchBroadcasts: 0,
  patchFallbacks: 0,
  patchCoalesced: 0,
  protocolErrors: 0,
  listenerReconnects: 0,
};

export function recordRealtimeMetric(name, details = {}) {
  if (name in counters) counters[name] += 1;
  if (realtimeChannel.hasSubscribers) {
    realtimeChannel.publish({ name, at: Date.now(), ...details });
  }
}

export function realtimeMetricsSnapshot() {
  return { ...counters };
}
