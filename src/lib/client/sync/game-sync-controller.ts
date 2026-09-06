import {
  applyGameCommandPatch,
  type ApplicableGameCommandResult,
  type GameCommandPatch,
} from "@/src/lib/game-command-patch";
import {
  applyGamePrivatePatch,
  type GamePrivatePatch,
} from "@/src/lib/game-private-patch";
import type { GameSnapshot } from "@/src/lib/game-contract";
import type {
  GamePatchEvent,
  GamePrivatePatchEvent,
  GameRealtimeEvent,
} from "@/src/lib/game-realtime-contract";
import { GameSnapshotCoordinator } from "./game-snapshot-coordinator";
import { RevisionCoordinator } from "./revision-coordinator";
import type { GameRealtimeMode } from "../transport/game-realtime-mode";
import type {
  GameRealtimeStateListener,
  GameRealtimeTransport,
} from "../transport/game-realtime-transport";
import { NullGameRealtimeTransport } from "../transport/null-game-realtime-transport";
import type { GameSnapshotTransport } from "../transport/game-snapshot-transport";
import { HttpGameSnapshotTransport } from "../transport/http-game-snapshot-transport";

export type GameSyncResult = {
  snapshot: GameSnapshot | null;
  changed: boolean;
  stale: boolean;
  unchanged: boolean;
  revision: number | null;
  responseBytes: number | null;
};

export type GameRealtimePatchResult = {
  applied: boolean;
  stale: boolean;
  snapshot: GameSnapshot | null;
};

export type GameRealtimePrivatePatchResult = GameRealtimePatchResult & {
  buffered: boolean;
};

type GameSyncControllerDependencies = {
  snapshotTransport?: GameSnapshotTransport;
  realtimeTransport?: GameRealtimeTransport;
  realtimeMode?: GameRealtimeMode;
};

type PendingRevisionFrame = {
  baseRevision: number;
  revision: number;
  publicPatch?: GameCommandPatch;
  privatePatch?: GamePrivatePatch;
};

export class GameSyncController {
  private readonly revisions = new RevisionCoordinator();
  private readonly snapshots = new GameSnapshotCoordinator();
  private readonly snapshotTransport: GameSnapshotTransport;
  private readonly realtimeTransport: GameRealtimeTransport;
  private readonly realtimeMode: GameRealtimeMode;
  private readonly pendingFrames = new Map<number, PendingRevisionFrame>();
  private unsubscribeRealtime: (() => void) | null = null;
  private forceSnapshotOnNextSync = false;

  constructor(
    private readonly roomId: string,
    dependencies: GameSyncControllerDependencies = {},
  ) {
    this.snapshotTransport =
      dependencies.snapshotTransport ?? new HttpGameSnapshotTransport();
    this.realtimeTransport =
      dependencies.realtimeTransport ?? new NullGameRealtimeTransport();
    this.realtimeMode = dependencies.realtimeMode ?? "off";
  }

  reset() {
    this.revisions.reset();
    this.snapshots.reset();
    this.pendingFrames.clear();
    this.forceSnapshotOnNextSync = false;
  }

  currentSnapshot() {
    return this.snapshots.current();
  }

  currentRevision() {
    return this.revisions.current();
  }

  requireRevision(revision: number) {
    this.revisions.require(revision);
  }

  forceSnapshot(revision?: number) {
    this.forceSnapshotOnNextSync = true;
    if (revision !== undefined) this.revisions.require(revision);
  }

  hasObservedRevision(revision: number) {
    return (
      !this.forceSnapshotOnNextSync && this.revisions.hasObserved(revision)
    );
  }

  needsRequiredRevision() {
    return this.forceSnapshotOnNextSync || this.revisions.needsRequiredRevision();
  }

  realtimeState() {
    return this.realtimeTransport.state();
  }

  realtimeClock() {
    return this.realtimeTransport.clock();
  }

  subscribeRealtimeState(listener: GameRealtimeStateListener) {
    return this.realtimeTransport.subscribeState(listener);
  }

  private discardFramesThrough(revision: number) {
    for (const pendingRevision of this.pendingFrames.keys()) {
      if (pendingRevision <= revision) {
        this.pendingFrames.delete(pendingRevision);
      }
    }
  }

  private bufferFramePatch(
    baseRevision: number,
    revision: number,
    patch: Pick<PendingRevisionFrame, "publicPatch" | "privatePatch">,
  ) {
    const existing = this.pendingFrames.get(revision);
    if (existing && existing.baseRevision !== baseRevision) return false;
    this.pendingFrames.set(revision, {
      baseRevision,
      revision,
      ...existing,
      ...patch,
    });
    return true;
  }

  private applyPendingPrivatePatch(
    snapshot: GameSnapshot,
    baseRevision: number,
    revision: number,
  ) {
    const frame = this.pendingFrames.get(revision);
    if (!frame?.privatePatch) return snapshot;
    if (frame.baseRevision !== baseRevision) return null;
    const nextSnapshot = applyGamePrivatePatch(snapshot, frame.privatePatch);
    if (!nextSnapshot) return null;
    this.pendingFrames.delete(revision);
    return nextSnapshot;
  }

  async sync(signal?: AbortSignal): Promise<GameSyncResult> {
    const previousSnapshot = this.snapshots.current();
    const forceSnapshot = this.forceSnapshotOnNextSync;
    const result = await this.snapshotTransport.fetchSnapshot({
      roomId: this.roomId,
      knownRevision: forceSnapshot ? null : this.revisions.current(),
      knownTopologyVersion: this.snapshots.knownTopologyVersion(),
      signal,
    });

    if (this.revisions.isStaleResponse(result.revision)) {
      return {
        snapshot: previousSnapshot,
        changed: false,
        stale: true,
        unchanged: result.kind === "unchanged",
        revision: result.revision,
        responseBytes: result.responseBytes,
      };
    }

    this.revisions.observe(result.revision);
    const nextSnapshot = this.snapshots.accept(result);
    if (result.revision !== null) {
      this.discardFramesThrough(result.revision);
    }
    if (forceSnapshot && result.kind === "snapshot") {
      this.forceSnapshotOnNextSync = false;
    }

    return {
      snapshot: nextSnapshot,
      changed: nextSnapshot !== previousSnapshot,
      stale: false,
      unchanged: result.kind === "unchanged",
      revision: result.revision,
      responseBytes: result.responseBytes,
    };
  }

  applyCommandResult(result: ApplicableGameCommandResult) {
    const currentSnapshot = this.snapshots.current();
    const currentRevision = this.revisions.current();
    if (!currentSnapshot) return null;

    if (!result.patch) {
      if (
        result.privatePatch &&
        result.revision !== null &&
        result.revision === currentRevision
      ) {
        const privateSnapshot = applyGamePrivatePatch(
          currentSnapshot,
          result.privatePatch,
        );
        if (!privateSnapshot) return null;
        return this.snapshots.replace(privateSnapshot);
      }
      return null;
    }

    if (!this.revisions.canApplyPatch(result.baseRevision, result.revision)) {
      return null;
    }

    const patchedSnapshot = applyGameCommandPatch(currentSnapshot, result.patch);
    if (!patchedSnapshot || result.revision === null || result.baseRevision === null) {
      return null;
    }

    let nextSnapshot = patchedSnapshot;
    if (result.privatePatch) {
      const privateSnapshot = applyGamePrivatePatch(nextSnapshot, result.privatePatch);
      if (!privateSnapshot) return null;
      nextSnapshot = privateSnapshot;
    } else {
      const withPendingPrivate = this.applyPendingPrivatePatch(
        nextSnapshot,
        result.baseRevision,
        result.revision,
      );
      if (!withPendingPrivate) return null;
      nextSnapshot = withPendingPrivate;
    }

    this.revisions.observe(result.revision);
    this.discardFramesThrough(result.revision);
    return this.snapshots.replace(nextSnapshot);
  }

  applyRealtimePatch(event: GamePatchEvent): GameRealtimePatchResult {
    if (event.roomId !== this.roomId) {
      return { applied: false, stale: true, snapshot: this.snapshots.current() };
    }

    const currentSnapshot = this.snapshots.current();
    const currentRevision = this.revisions.current();
    if (!currentSnapshot || currentRevision === null) {
      this.forceSnapshot(event.revision);
      return { applied: false, stale: false, snapshot: currentSnapshot };
    }

    if (event.revision <= currentRevision) {
      return { applied: false, stale: true, snapshot: currentSnapshot };
    }

    if (!this.revisions.canApplyPatch(event.baseRevision, event.revision)) {
      this.forceSnapshot(event.revision);
      return { applied: false, stale: false, snapshot: currentSnapshot };
    }

    if (
      !this.bufferFramePatch(event.baseRevision, event.revision, {
        publicPatch: event.patch,
      })
    ) {
      this.forceSnapshot(event.revision);
      return { applied: false, stale: false, snapshot: currentSnapshot };
    }

    const publicSnapshot = applyGameCommandPatch(currentSnapshot, event.patch);
    if (!publicSnapshot) {
      this.forceSnapshot(event.revision);
      return { applied: false, stale: false, snapshot: currentSnapshot };
    }

    const nextSnapshot = this.applyPendingPrivatePatch(
      publicSnapshot,
      event.baseRevision,
      event.revision,
    );
    if (!nextSnapshot) {
      this.forceSnapshot(event.revision);
      return { applied: false, stale: false, snapshot: currentSnapshot };
    }

    this.revisions.observe(event.revision);
    this.discardFramesThrough(event.revision);
    return {
      applied: true,
      stale: false,
      snapshot: this.snapshots.replace(nextSnapshot),
    };
  }

  applyRealtimePrivatePatch(
    event: GamePrivatePatchEvent,
  ): GameRealtimePrivatePatchResult {
    if (event.roomId !== this.roomId) {
      return {
        applied: false,
        stale: true,
        buffered: false,
        snapshot: this.snapshots.current(),
      };
    }

    const currentSnapshot = this.snapshots.current();
    const currentRevision = this.revisions.current();
    if (!currentSnapshot || currentRevision === null) {
      this.forceSnapshot(event.revision);
      return {
        applied: false,
        stale: false,
        buffered: false,
        snapshot: currentSnapshot,
      };
    }

    if (event.revision < currentRevision) {
      return {
        applied: false,
        stale: true,
        buffered: false,
        snapshot: currentSnapshot,
      };
    }

    if (event.revision === currentRevision) {
      const privateSnapshot = applyGamePrivatePatch(currentSnapshot, event.patch);
      if (!privateSnapshot) {
        this.forceSnapshot(event.revision);
        return {
          applied: false,
          stale: false,
          buffered: false,
          snapshot: currentSnapshot,
        };
      }
      return {
        applied: true,
        stale: false,
        buffered: false,
        snapshot: this.snapshots.replace(privateSnapshot),
      };
    }

    if (
      event.baseRevision !== currentRevision ||
      !this.bufferFramePatch(event.baseRevision, event.revision, {
        privatePatch: event.patch,
      })
    ) {
      this.forceSnapshot(event.revision);
      return {
        applied: false,
        stale: false,
        buffered: false,
        snapshot: currentSnapshot,
      };
    }

    return {
      applied: false,
      stale: false,
      buffered: true,
      snapshot: currentSnapshot,
    };
  }

  connectRealtime(onEvent: (event: GameRealtimeEvent) => void) {
    if (this.realtimeMode === "off" || this.unsubscribeRealtime) return;
    this.unsubscribeRealtime = this.realtimeTransport.connect({
      roomId: this.roomId,
      knownRevision: this.revisions.current(),
      onEvent,
    });
  }

  disconnectRealtime() {
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtime = null;
    this.realtimeTransport.disconnect();
  }
}
