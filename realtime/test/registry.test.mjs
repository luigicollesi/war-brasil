import assert from "node:assert/strict";
import test from "node:test";
import { GameRealtimeRegistry } from "../registry.mjs";

function fakeSocket() {
  return {
    readyState: 1,
    bufferedAmount: 0,
    sent: [],
    pings: 0,
    terminated: false,
    closed: null,
    send(value) {
      this.sent.push(JSON.parse(value));
    },
    ping() {
      this.pings += 1;
    },
    terminate() {
      this.terminated = true;
    },
    close(code, reason) {
      this.closed = { code, reason };
    },
  };
}

test("registry envia somente revisions monotônicas", () => {
  const registry = new GameRealtimeRegistry();
  const socket = fakeSocket();
  registry.add(socket, { roomId: "12", playerId: "7" });
  registry.sendReady(socket, 4);
  registry.broadcastInvalidation("12", 4);
  registry.broadcastInvalidation("12", 5);
  registry.broadcastInvalidation("12", 3);

  assert.deepEqual(
    socket.sent.map((event) => [event.type, event.payload.revision]),
    [
      ["realtime.ready", 4],
      ["game.invalidate", 5],
    ],
  );
});

test("registry coalesce revisions quando o socket está congestionado", () => {
  const registry = new GameRealtimeRegistry();
  const socket = fakeSocket();
  registry.add(socket, { roomId: "12", playerId: "7" });
  registry.sendReady(socket, 4);

  socket.bufferedAmount = 100_000;
  registry.broadcastInvalidation("12", 5);
  registry.broadcastInvalidation("12", 8);
  assert.equal(socket.sent.length, 1);

  socket.bufferedAmount = 0;
  registry.heartbeat();

  assert.equal(socket.sent.at(-1).type, "game.invalidate");
  assert.equal(socket.sent.at(-1).payload.revision, 8);
  assert.equal(socket.pings, 1);
});
