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
    this.discardFramesThrough(result.revision);
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
        return privateSnapshot ? this.snapshots.apply(privateSnapshot) : null;
      }
      return null;
    }

    if (!this.revisions.canApplyPatch(result.baseRevision, result.revision)) {
      return null;
    }

    let nextSnapshot = applyGameCommandPatch(currentSnapshot, result.patch);
    if (!nextSnapshot) return null;

    if (result.privatePatch) {
      nextSnapshot = applyGamePrivatePatch(nextSnapshot, result.privatePatch);
      if (!nextSnapshot) return null;
      if (result.revision !== null) this.pendingFrames.delete(result.revision);
    } else if (result.baseRevision !== null && result.revision !== null) {
      nextSnapshot = this.applyPendingPrivatePatch(
        nextSnapshot,
        result.baseRevision,
        result.revision,
      );
      if (!nextSnapshot) return null;
    }

    this.revisions.observe(result.revision);
    return this.snapshots.apply(nextSnapshot);
  }

  applyRealtimePatch(event: GamePatchEvent): GameRealtimePatchResult {
    const { baseRevision, revision, patch } = event.payload;
    const currentRevision = this.revisions.current();

    if (currentRevision !== null && revision <= currentRevision) {
      return {
        applied: false,
        stale: true,
        snapshot: this.snapshots.current(),
      };
    }

    if (this.realtimeMode !== "hybrid") {
      return { applied: false, stale: false, snapshot: null };
    }

    if (currentRevision !== baseRevision) {
      this.forceSnapshot(revision);
      return { applied: false, stale: false, snapshot: null };
    }

    this.bufferFramePatch(baseRevision, revision, { publicPatch: patch });
    const snapshot = this.applyCommandResult({
      baseRevision,
      revision,
      patch,
    });
    if (snapshot) {
      this.pendingFrames.delete(revision);
      return { applied: true, stale: false, snapshot };
    }

    this.forceSnapshot(revision);
    return { applied: false, stale: false, snapshot: null };
  }

  applyRealtimePrivatePatch(
    event: GamePrivatePatchEvent,
  ): GameRealtimePrivatePatchResult {
    const { baseRevision, revision, patch } = event.payload;
    const currentRevision = this.revisions.current();
    const currentSnapshot = this.snapshots.current();

    if (!currentSnapshot || currentRevision === null) {
      this.forceSnapshot(revision);
      return { applied: false, stale: false, buffered: false, snapshot: null };
    }

    if (revision < currentRevision) {
      return {
        applied: false,
        stale: true,
        buffered: false,
        snapshot: currentSnapshot,
      };
    }

    if (revision === currentRevision) {
      const nextSnapshot = applyGamePrivatePatch(currentSnapshot, patch);
      if (!nextSnapshot) {
        this.forceSnapshot(revision);
        return { applied: false, stale: false, buffered: false, snapshot: null };
      }
      this.pendingFrames.delete(revision);
      return {
        applied: true,
        stale: false,
        buffered: false,
        snapshot: this.snapshots.apply(nextSnapshot),
      };
    }

    if (baseRevision === currentRevision) {
      if (!this.bufferFramePatch(baseRevision, revision, { privatePatch: patch })) {
        this.forceSnapshot(revision);
        return { applied: false, stale: false, buffered: false, snapshot: null };
      }
      this.revisions.require(revision);
      return {
        applied: false,
        stale: false,
        buffered: true,
        snapshot: currentSnapshot,
      };
    }

    this.forceSnapshot(revision);
    return { applied: false, stale: false, buffered: false, snapshot: null };
  }

  async startRealtime(onEvent?: (event: GameRealtimeEvent) => void) {
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtime = this.realtimeTransport.subscribe((event) => {
      if (event.roomId !== this.roomId) return;
      if (
        this.realtimeMode === "hybrid" &&
        event.type === "game.private.invalidate"
      ) {
        this.forceSnapshot(event.payload.revision);
        onEvent?.({ ...event, type: "game.invalidate" });
        return;
      }
      if (
        this.realtimeMode === "hybrid" &&
        (event.type === "game.invalidate" || event.type === "realtime.ready")
      ) {
        this.revisions.require(event.payload.revision);
      }
      onEvent?.(event);
    });

    await this.realtimeTransport.connect({
      roomId: this.roomId,
      revision: this.revisions.current(),
    });
  }

  stopRealtime() {
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtime = null;
    this.realtimeTransport.disconnect();
  }
}
