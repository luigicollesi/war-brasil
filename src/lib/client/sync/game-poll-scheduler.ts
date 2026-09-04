import { nextGamePollDelay } from "../game-polling";
import type { GameRealtimeMode } from "../transport/game-realtime-mode";
import type { GameRealtimeState } from "../transport/game-realtime-transport";

const HYBRID_VISIBLE_WATCHDOG_MS = 30_000;
const HYBRID_HIDDEN_WATCHDOG_MS = 60_000;

export class GamePollScheduler {
  private consecutiveFailures = 0;

  reset() {
    this.consecutiveFailures = 0;
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
  }

  recordFailure() {
    this.consecutiveFailures += 1;
  }

  failures() {
    return this.consecutiveFailures;
  }

  nextDelay(input: {
    visible: boolean;
    online: boolean;
    presentationPending: boolean;
    realtimeMode?: GameRealtimeMode;
    realtimeState?: GameRealtimeState;
  }) {
    if (
      input.realtimeMode === "hybrid" &&
      input.realtimeState === "connected" &&
      input.online &&
      !input.presentationPending &&
      this.consecutiveFailures === 0
    ) {
      return input.visible
        ? HYBRID_VISIBLE_WATCHDOG_MS
        : HYBRID_HIDDEN_WATCHDOG_MS;
    }

    return nextGamePollDelay({
      visible: input.visible,
      online: input.online,
      presentationPending: input.presentationPending,
      failures: this.consecutiveFailures,
    });
  }
}
