import type { GameSnapshotPayload } from "@/src/lib/game-snapshot-hydration";

export type GameSnapshotTransportInput = {
  roomId: string;
  knownRevision: number | null;
  knownTopologyVersion: string | null;
  signal?: AbortSignal;
};

export type GameSnapshotTransportResult =
  | {
      kind: "unchanged";
      revision: number | null;
      topologyVersion: string | null;
      responseBytes: number | null;
    }
  | {
      kind: "snapshot";
      revision: number | null;
      topologyVersion: string | null;
      responseBytes: number | null;
      payload: GameSnapshotPayload;
    };

export interface GameSnapshotTransport {
  fetchSnapshot(
    input: GameSnapshotTransportInput,
  ): Promise<GameSnapshotTransportResult>;
}
