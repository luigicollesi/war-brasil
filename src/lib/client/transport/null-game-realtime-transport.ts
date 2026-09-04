import type {
  GameRealtimeConnectionInput,
  GameRealtimeListener,
  GameRealtimeTransport,
} from "./game-realtime-transport";

export class NullGameRealtimeTransport implements GameRealtimeTransport {
  async connect(_input: GameRealtimeConnectionInput) {}

  subscribe(_listener: GameRealtimeListener) {
    return () => {};
  }

  disconnect() {}
}
