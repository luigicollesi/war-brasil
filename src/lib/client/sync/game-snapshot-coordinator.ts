import type { GameSnapshot } from "@/src/lib/game-contract";
import { hydrateGameSnapshot } from "@/src/lib/game-snapshot-hydration";
import { shareGameSnapshot } from "@/src/lib/game-snapshot-sharing";
import type { GameSnapshotTransportResult } from "../transport/game-snapshot-transport";

export class GameSnapshotCoordinator {
  private currentSnapshot: GameSnapshot | null = null;
  private topologyVersion: string | null = null;
  private baseConnections: GameSnapshot["connections"] | null = null;

  reset() {
    this.currentSnapshot = null;
    this.topologyVersion = null;
    this.baseConnections = null;
  }

  current() {
    return this.currentSnapshot;
  }

  knownTopologyVersion() {
    return this.baseConnections ? this.topologyVersion : null;
  }

  accept(result: GameSnapshotTransportResult) {
    if (result.kind === "unchanged") return this.currentSnapshot;

    const baseConnections = result.payload.connections ?? this.baseConnections;
    if (!baseConnections) {
      throw new Error("A topologia da partida não foi recebida.");
    }

    if (result.payload.connections) {
      this.baseConnections = result.payload.connections;
      if (result.topologyVersion) {
        this.topologyVersion = result.topologyVersion;
      }
    }

    const hydratedSnapshot = hydrateGameSnapshot(result.payload, baseConnections);
    this.currentSnapshot = shareGameSnapshot(
      this.currentSnapshot,
      hydratedSnapshot,
    );

    return this.currentSnapshot;
  }

  apply(snapshot: GameSnapshot) {
    this.currentSnapshot = snapshot;
    return snapshot;
  }
}
