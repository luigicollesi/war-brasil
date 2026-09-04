import type {
  GameRealtimeConnectionInput,
  GameRealtimeListener,
  GameRealtimeState,
  GameRealtimeStateListener,
  GameRealtimeTransport,
} from "./game-realtime-transport";

export class NullGameRealtimeTransport implements GameRealtimeTransport {
  async connect(_input: GameRealtimeConnectionInput) {}

  subscribe(_listener: GameRealtimeListener) {
    return () => {};
  }

  subscribeState(listener: GameRealtimeStateListener) {
    listener("closed");
    return () => {};
  }

  state(): GameRealtimeState {
    return "closed";
  }

  clock() {
    return null;
  }

  disconnect() {}
}
