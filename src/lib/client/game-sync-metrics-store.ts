"use client";

export type GameSyncMetrics = {
  latencyMs: number | null;
  failures: number;
  online: boolean;
  snapshotRequests?: number;
  unchangedResponses?: number;
  payloadBytes?: number;
  revisionGaps?: number;
  snapshotRecoveries?: number;
};

type Listener = () => void;

type SyncSuccessDetails = {
  unchanged?: boolean;
  responseBytes?: number | null;
};

let snapshot: GameSyncMetrics = {
  latencyMs: null,
  failures: 0,
  online: true,
  snapshotRequests: 0,
  unchangedResponses: 0,
  payloadBytes: 0,
  revisionGaps: 0,
  snapshotRecoveries: 0,
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

  recordSuccess(latencyMs: number, details: SyncSuccessDetails = {}) {
    publish({
      ...snapshot,
      online: true,
      failures: 0,
      latencyMs:
        snapshot.latencyMs === null
          ? latencyMs
          : snapshot.latencyMs * 0.7 + latencyMs * 0.3,
      snapshotRequests: (snapshot.snapshotRequests ?? 0) + 1,
      unchangedResponses:
        (snapshot.unchangedResponses ?? 0) + (details.unchanged ? 1 : 0),
      payloadBytes:
        (snapshot.payloadBytes ?? 0) + Math.max(0, details.responseBytes ?? 0),
    });
  },

  recordFailure() {
    publish({
      ...snapshot,
      failures: Math.min(3, snapshot.failures + 1),
      snapshotRequests: (snapshot.snapshotRequests ?? 0) + 1,
    });
  },

  recordRevisionGap() {
    publish({
      ...snapshot,
      revisionGaps: (snapshot.revisionGaps ?? 0) + 1,
    });
  },

  recordSnapshotRecovery() {
    publish({
      ...snapshot,
      snapshotRecoveries: (snapshot.snapshotRecoveries ?? 0) + 1,
    });
  },

  recordOffline() {
    publish({ ...snapshot, online: false, failures: 3 });
  },

  recordOnline() {
    publish({ ...snapshot, online: true, failures: 0 });
  },
};
