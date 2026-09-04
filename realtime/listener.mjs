import { Client } from "pg";
import { recordRealtimeMetric } from "./metrics.mjs";
import { gameRealtimeChannel, parseNotificationPayload } from "./protocol.mjs";

const MAX_RECONNECT_DELAY_MS = 15_000;

export class PostgresRealtimeListener {
  constructor({ connectionString, onInvalidation, onHealthChange }) {
    this.connectionString = connectionString;
    this.onInvalidation = onInvalidation;
    this.onHealthChange = onHealthChange;
    this.client = null;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.stopped = true;
    this.healthy = false;
  }

  async start() {
    this.stopped = false;
    await this.connect();
  }

  async connect() {
    if (this.stopped) return;

    const client = new Client({ connectionString: this.connectionString });
    this.client = client;

    client.on("notification", (message) => {
      if (message.channel !== gameRealtimeChannel() || !message.payload) return;
      const payload = parseNotificationPayload(message.payload);
      if (payload) this.onInvalidation(payload);
    });

    client.on("error", () => {
      void this.handleDisconnect(client);
    });
    client.on("end", () => {
      void this.handleDisconnect(client);
    });

    try {
      await client.connect();
      await client.query(`LISTEN ${gameRealtimeChannel()}`);
      if (this.client !== client || this.stopped) {
        await client.end().catch(() => {});
        return;
      }
      this.reconnectAttempt = 0;
      this.setHealthy(true);
    } catch {
      await this.handleDisconnect(client);
    }
  }

  async handleDisconnect(client) {
    if (this.client !== client) return;
    this.client = null;
    this.setHealthy(false);
    try {
      await client.end();
    } catch {}
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;

    const base = Math.min(
      MAX_RECONNECT_DELAY_MS,
      500 * 2 ** Math.min(this.reconnectAttempt, 5),
    );
    const jitter = 0.8 + Math.random() * 0.4;
    const delay = Math.round(base * jitter);
    this.reconnectAttempt += 1;
    recordRealtimeMetric("listenerReconnects", { delay });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
    this.reconnectTimer.unref?.();
  }

  setHealthy(value) {
    if (this.healthy === value) return;
    this.healthy = value;
    this.onHealthChange(value);
  }

  isHealthy() {
    return this.healthy;
  }

  async stop() {
    this.stopped = true;
    this.setHealthy(false);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const client = this.client;
    this.client = null;
    if (client) {
      try {
        await client.end();
      } catch {}
    }
  }
}
