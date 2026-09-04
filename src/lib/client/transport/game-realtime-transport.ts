import type { GameRealtimeEvent } from "@/src/lib/game-realtime-contract";
import type { GameServerClockSnapshot } from "../sync/game-server-clock";

export type GameRealtimeConnectionInput = {
  roomId: string;
  revision: number | null;
};

export type GameRealtimeState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "degraded"
  | "closed";

export type GameRealtimeListener = (event: GameRealtimeEvent) => void;
export type GameRealtimeStateListener = (state: GameRealtimeState) => void;

export interface GameRealtimeTransport {
  connect(input: GameRealtimeConnectionInput): Promise<void>;
  subscribe(listener: GameRealtimeListener): () => void;
  subscribeState(listener: GameRealtimeStateListener): () => void;
  state(): GameRealtimeState;
  clock(): GameServerClockSnapshot | null;
  disconnect(): void;
}
