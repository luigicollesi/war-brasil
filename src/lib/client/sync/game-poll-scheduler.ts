import { nextGamePollDelay } from "../game-polling";

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
  }) {
    return nextGamePollDelay({
      ...input,
      failures: this.consecutiveFailures,
    });
  }
}
