export type GameServerClockSnapshot = {
  offsetMs: number;
  rttMs: number;
  sampledAt: number;
};

export class GameServerClock {
  private sample: GameServerClockSnapshot | null = null;

  reset() {
    this.sample = null;
  }

  recordSample(clientSentAt: number, serverTime: number, clientReceivedAt: number) {
    const rttMs = Math.max(0, clientReceivedAt - clientSentAt);
    const midpoint = clientSentAt + rttMs / 2;
    const measuredOffset = serverTime - midpoint;

    if (!this.sample) {
      this.sample = {
        offsetMs: measuredOffset,
        rttMs,
        sampledAt: clientReceivedAt,
      };
      return this.sample;
    }

    this.sample = {
      offsetMs: this.sample.offsetMs * 0.7 + measuredOffset * 0.3,
      rttMs: this.sample.rttMs * 0.7 + rttMs * 0.3,
      sampledAt: clientReceivedAt,
    };
    return this.sample;
  }

  snapshot() {
    return this.sample;
  }

  serverNow(clientNow = Date.now()) {
    return clientNow + (this.sample?.offsetMs ?? 0);
  }
}
