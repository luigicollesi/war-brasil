import type { GameRealtimeEvent } from "@/src/lib/game-realtime-contract";

export type GameRealtimeConnectionInput = {
  roomId: string;
  revision: number | null;
};

export type GameRealtimeListener = (event: GameRealtimeEvent) => void;

export interface GameRealtimeTransport {
  connect(input: GameRealtimeConnectionInput): Promise<void>;
  subscribe(listener: GameRealtimeListener): () => void;
  disconnect(): void;
}
