import type {
  GameRealtimeState,
  GameRealtimeStateListener,
  GameRealtimeTransport,
} from "./game-realtime-transport";

export class NullGameRealtimeTransport implements GameRealtimeTransport {
  async connect() {}

  subscribe() {
    return () => undefined;
  }

  subscribeState(listener: GameRealtimeStateListener) {
    listener("closed");
    return () => undefined;
  }

  state(): GameRealtimeState {
    return "closed";
  }

  clock() {
    return null;
  }

  disconnect() {}
}
