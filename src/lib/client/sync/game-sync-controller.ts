import {
  applyGameCommandPatch,
  type ApplicableGameCommandResult,
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

export class GameSyncController {
  private readonly revisions = new RevisionCoordinator();
  private readonly snapshots = new GameSnapshotCoordinator();
  private readonly snapshotTransport: GameSnapshotTransport;
  private readonly realtimeTransport: GameRealtimeTransport;
  private readonly realtimeMode: GameRealtimeMode;
  private readonly pendingPrivatePatches = new Map<number, GamePrivatePatch>();
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
    this.pendingPrivatePatches.clear();
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

  private discardPrivatePatchesThrough(revision: number) {
    for (const pendingRevision of this.pendingPrivatePatches.keys()) {
      if (pendingRevision <= revision) {
        this.pendingPrivatePatches.delete(pendingRevision);
      }
    }
  }

  private applyPendingPrivatePatch(snapshot: GameSnapshot, revision: number) {
    const patch = this.pendingPrivatePatches.get(revision);
    if (!patch) return snapshot;
    const nextSnapshot = applyGamePrivatePatch(snapshot, patch);
    if (!nextSnapshot) return null;
    this.pendingPrivatePatches.delete(revision);
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
    this.discardPrivatePatchesThrough(result.revision);
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
    if (
      !currentSnapshot ||
      !result.patch ||
      !this.revisions.canApplyPatch(result.baseRevision, result.revision)
    ) {
      return null;
    }

    let nextSnapshot = applyGameCommandPatch(currentSnapshot, result.patch);
    if (!nextSnapshot) return null;

    if (result.privatePatch) {
      nextSnapshot = applyGamePrivatePatch(nextSnapshot, result.privatePatch);
      if (!nextSnapshot) return null;
    } else if (result.revision !== null) {
      nextSnapshot = this.applyPendingPrivatePatch(nextSnapshot, result.revision);
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

    const snapshot = this.applyCommandResult({
      baseRevision,
      revision,
      patch,
    });
    if (snapshot) {
      return { applied: true, stale: false, snapshot };
    }

    this.revisions.require(revision);
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
      return {
        applied: true,
        stale: false,
        buffered: false,
        snapshot: this.snapshots.apply(nextSnapshot),
      };
    }

    if (baseRevision === currentRevision) {
      this.pendingPrivatePatches.set(revision, patch);
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
