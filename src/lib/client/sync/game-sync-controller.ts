import {
  applyGameCommandPatch,
  type ApplicableGameCommandResult,
} from "@/src/lib/game-command-patch";
import type { GameSnapshot } from "@/src/lib/game-contract";
import type { GameRealtimeEvent } from "@/src/lib/game-realtime-contract";
import { GameSnapshotCoordinator } from "./game-snapshot-coordinator";
import { RevisionCoordinator } from "./revision-coordinator";
import type { GameRealtimeTransport } from "../transport/game-realtime-transport";
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

type GameSyncControllerDependencies = {
  snapshotTransport?: GameSnapshotTransport;
  realtimeTransport?: GameRealtimeTransport;
};

export class GameSyncController {
  private readonly revisions = new RevisionCoordinator();
  private readonly snapshots = new GameSnapshotCoordinator();
  private readonly snapshotTransport: GameSnapshotTransport;
  private readonly realtimeTransport: GameRealtimeTransport;
  private unsubscribeRealtime: (() => void) | null = null;

  constructor(
    private readonly roomId: string,
    dependencies: GameSyncControllerDependencies = {},
  ) {
    this.snapshotTransport =
      dependencies.snapshotTransport ?? new HttpGameSnapshotTransport();
    this.realtimeTransport =
      dependencies.realtimeTransport ?? new NullGameRealtimeTransport();
  }

  reset() {
    this.revisions.reset();
    this.snapshots.reset();
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

  hasObservedRevision(revision: number) {
    return this.revisions.hasObserved(revision);
  }

  needsRequiredRevision() {
    return this.revisions.needsRequiredRevision();
  }

  async sync(signal?: AbortSignal): Promise<GameSyncResult> {
    const previousSnapshot = this.snapshots.current();
    const result = await this.snapshotTransport.fetchSnapshot({
      roomId: this.roomId,
      knownRevision: this.revisions.current(),
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

    const nextSnapshot = applyGameCommandPatch(currentSnapshot, result.patch);
    if (!nextSnapshot) return null;

    this.revisions.observe(result.revision);
    return this.snapshots.apply(nextSnapshot);
  }

  async startRealtime(onEvent?: (event: GameRealtimeEvent) => void) {
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtime = this.realtimeTransport.subscribe((event) => {
      if (event.roomId !== this.roomId) return;
      if (event.type === "game.invalidate") {
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
