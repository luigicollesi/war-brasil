import {
  GAME_REVISION_HEADER,
  GAME_TOPOLOGY_HEADER,
  parseGameRevision,
} from "@/src/lib/game-sync-contract";
import type { GameSnapshotPayload } from "@/src/lib/game-snapshot-hydration";
import type {
  GameSnapshotTransport,
  GameSnapshotTransportInput,
  GameSnapshotTransportResult,
} from "./game-snapshot-transport";

function responseMessage(data: unknown, fallback: string) {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
      ? data.error
      : fallback
  );
}

function responseBytes(response: Response) {
  const value = response.headers.get("content-length");
  if (!value || !/^\d+$/.test(value)) return null;
  const bytes = Number(value);
  return Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : null;
}

export class HttpGameSnapshotTransport implements GameSnapshotTransport {
  async fetchSnapshot(
    input: GameSnapshotTransportInput,
  ): Promise<GameSnapshotTransportResult> {
    const headers = new Headers();
    if (input.knownRevision !== null) {
      headers.set(GAME_REVISION_HEADER, String(input.knownRevision));
    }
    if (input.knownTopologyVersion !== null) {
      headers.set(GAME_TOPOLOGY_HEADER, input.knownTopologyVersion);
    }

    const response = await fetch(
      `/api/games/${encodeURIComponent(input.roomId)}`,
      {
        cache: "no-store",
        headers,
        signal: input.signal,
      },
    );
    const revision = parseGameRevision(response.headers.get(GAME_REVISION_HEADER));
    const topologyVersion = response.headers.get(GAME_TOPOLOGY_HEADER);
    const bytes = responseBytes(response);

    if (response.status === 204) {
      return {
        kind: "unchanged",
        revision,
        topologyVersion,
        responseBytes: bytes,
      };
    }

    const data: unknown = await response.json();
    if (!response.ok) {
      throw new Error(
        responseMessage(data, "Não foi possível atualizar a partida."),
      );
    }

    return {
      kind: "snapshot",
      revision,
      topologyVersion,
      responseBytes: bytes,
      payload: data as GameSnapshotPayload,
    };
  }
}
