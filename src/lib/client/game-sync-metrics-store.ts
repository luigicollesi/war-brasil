"use client";

import type { GameRealtimeEvent } from "@/src/lib/game-realtime-contract";
import type { GameRealtimeState } from "./transport/game-realtime-transport";

export type GameSyncMetrics = {
  latencyMs: number | null;
  failures: number;
  online: boolean;
  snapshotRequests?: number;
  unchangedResponses?: number;
  payloadBytes?: number;
  revisionGaps?: number;
  snapshotRecoveries?: number;
  realtimeState?: GameRealtimeState;
  realtimeConnections?: number;
  realtimeReconnects?: number;
  realtimeEvents?: number;
  realtimeInvalidations?: number;
  realtimeReadyEvents?: number;
  realtimePatches?: number;
  realtimePatchesApplied?: number;
  realtimePatchFallbacks?: number;
  realtimeStaleEvents?: number;
  realtimeDuplicateEvents?: number;
  realtimePotentialMisses?: number;
  realtimeLeadMs?: number | null;
  realtimeRttMs?: number | null;
  realtimeClockOffsetMs?: number | null;
};

type Listener = () => void;

type SyncSuccessDetails = {
  unchanged?: boolean;
  responseBytes?: number | null;
  revision?: number | null;
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
  realtimeState: "idle",
  realtimeConnections: 0,
  realtimeReconnects: 0,
  realtimeEvents: 0,
  realtimeInvalidations: 0,
  realtimeReadyEvents: 0,
  realtimePatches: 0,
  realtimePatchesApplied: 0,
  realtimePatchFallbacks: 0,
  realtimeStaleEvents: 0,
  realtimeDuplicateEvents: 0,
  realtimePotentialMisses: 0,
  realtimeLeadMs: null,
  realtimeRttMs: null,
  realtimeClockOffsetMs: null,
};

let lastRealtimeRevision: number | null = null;
let lastRealtimeRevisionAt: number | null = null;
const listeners = new Set<Listener>();

function publish(next: GameSyncMetrics) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function smoothed(previous: number | null | undefined, next: number) {
  return previous === null || previous === undefined
    ? next
    : previous * 0.7 + next * 0.3;
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
    const now = Date.now();
    let realtimeLeadMs = snapshot.realtimeLeadMs ?? null;
    let realtimePotentialMisses = snapshot.realtimePotentialMisses ?? 0;

    if (
      details.revision !== null &&
      details.revision !== undefined &&
      lastRealtimeRevision !== null
    ) {
      if (details.revision > lastRealtimeRevision && snapshot.realtimeState === "connected") {
        realtimePotentialMisses += 1;
      }
      if (
        details.revision >= lastRealtimeRevision &&
        lastRealtimeRevisionAt !== null
      ) {
        realtimeLeadMs = smoothed(realtimeLeadMs, now - lastRealtimeRevisionAt);
        lastRealtimeRevision = null;
        lastRealtimeRevisionAt = null;
      }
    }

    publish({
      ...snapshot,
      online: true,
      failures: 0,
      latencyMs: smoothed(snapshot.latencyMs, latencyMs),
      snapshotRequests: (snapshot.snapshotRequests ?? 0) + 1,
      unchangedResponses:
        (snapshot.unchangedResponses ?? 0) + (details.unchanged ? 1 : 0),
      payloadBytes:
        (snapshot.payloadBytes ?? 0) + Math.max(0, details.responseBytes ?? 0),
      realtimeLeadMs,
      realtimePotentialMisses,
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

  recordRealtimeState(state: GameRealtimeState) {
    const previous = snapshot.realtimeState;
    publish({
      ...snapshot,
      realtimeState: state,
      realtimeConnections:
        (snapshot.realtimeConnections ?? 0) +
        (state === "connected" && previous !== "connected" ? 1 : 0),
      realtimeReconnects:
        (snapshot.realtimeReconnects ?? 0) +
        (state === "reconnecting" && previous !== "reconnecting" ? 1 : 0),
    });
  },

  recordRealtimeEvent(event: GameRealtimeEvent, currentRevision: number | null) {
    let revision: number | null = null;
    let invalidations = snapshot.realtimeInvalidations ?? 0;
    let readyEvents = snapshot.realtimeReadyEvents ?? 0;
    let patches = snapshot.realtimePatches ?? 0;

    if (event.type === "game.invalidate") {
      revision = event.payload.revision;
      invalidations += 1;
    } else if (event.type === "realtime.ready") {
      revision = event.payload.revision;
      readyEvents += 1;
    } else if (event.type === "game.patch") {
      revision = event.payload.revision;
      patches += 1;
    }

    if (revision !== null && (lastRealtimeRevision === null || revision > lastRealtimeRevision)) {
      lastRealtimeRevision = revision;
      lastRealtimeRevisionAt = Date.now();
    }

    publish({
      ...snapshot,
      realtimeEvents: (snapshot.realtimeEvents ?? 0) + 1,
      realtimeInvalidations: invalidations,
      realtimeReadyEvents: readyEvents,
      realtimePatches: patches,
      realtimeStaleEvents:
        (snapshot.realtimeStaleEvents ?? 0) +
        (revision !== null && currentRevision !== null && revision < currentRevision
          ? 1
          : 0),
      realtimeDuplicateEvents:
        (snapshot.realtimeDuplicateEvents ?? 0) +
        (revision !== null && currentRevision !== null && revision === currentRevision
          ? 1
          : 0),
    });
  },

  recordRealtimePatchResult(result: { applied: boolean; stale: boolean }) {
    if (result.stale) return;
    publish({
      ...snapshot,
      realtimePatchesApplied:
        (snapshot.realtimePatchesApplied ?? 0) + (result.applied ? 1 : 0),
      realtimePatchFallbacks:
        (snapshot.realtimePatchFallbacks ?? 0) + (result.applied ? 0 : 1),
      revisionGaps:
        (snapshot.revisionGaps ?? 0) + (result.applied ? 0 : 1),
      snapshotRecoveries:
        (snapshot.snapshotRecoveries ?? 0) + (result.applied ? 0 : 1),
    });
  },

  recordRealtimeClock(clock: { rttMs: number; offsetMs: number } | null) {
    if (!clock) return;
    publish({
      ...snapshot,
      realtimeRttMs: smoothed(snapshot.realtimeRttMs, clock.rttMs),
      realtimeClockOffsetMs: smoothed(
        snapshot.realtimeClockOffsetMs,
        clock.offsetMs,
      ),
    });
  },

  recordOffline() {
    publish({ ...snapshot, online: false, failures: 3 });
  },

  recordOnline() {
    publish({ ...snapshot, online: true, failures: 0 });
  },
};
