"use client";

export type GameSyncMetrics = {
  latencyMs: number | null;
  failures: number;
  online: boolean;
};

type Listener = () => void;

let snapshot: GameSyncMetrics = {
  latencyMs: null,
  failures: 0,
  online: true,
};

const listeners = new Set<Listener>();

function publish(next: GameSyncMetrics) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export const gameSyncMetricsStore = {
  getSnapshot() {
    return snapshot;
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  recordSuccess(latencyMs: number) {
    publish({
      online: true,
      failures: 0,
      latencyMs:
        snapshot.latencyMs === null
          ? latencyMs
          : snapshot.latencyMs * 0.7 + latencyMs * 0.3,
    });
  },

  recordFailure() {
    publish({
      ...snapshot,
      failures: Math.min(3, snapshot.failures + 1),
    });
  },

  recordOffline() {
    publish({ ...snapshot, online: false, failures: 3 });
  },

  recordOnline() {
    publish({ ...snapshot, online: true, failures: 0 });
  },
};
