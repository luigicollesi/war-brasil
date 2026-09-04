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

test("ready nunca regride revision após evento durante handshake", () => {
  const registry = new GameRealtimeRegistry();
  const socket = fakeSocket();
  registry.add(socket, { roomId: "12", playerId: "7" });

  registry.broadcastInvalidation("12", 6);
  registry.sendReady(socket, 5);

  assert.deepEqual(
    socket.sent.map((event) => [event.type, event.payload.revision]),
    [
      ["game.invalidate", 6],
      ["realtime.ready", 6],
    ],
  );
});

test("registry entrega invalidation privada somente ao jogador alvo", () => {
  const registry = new GameRealtimeRegistry();
  const target = fakeSocket();
  const other = fakeSocket();
  registry.add(target, { roomId: "12", playerId: "7" });
  registry.add(other, { roomId: "12", playerId: "8" });
  registry.sendReady(target, 5);
  registry.sendReady(other, 5);

  registry.broadcastInvalidation("12", 5, "7");

  assert.deepEqual(
    target.sent.map((event) => event.type),
    ["realtime.ready", "game.private.invalidate"],
  );
  assert.deepEqual(
    other.sent.map((event) => event.type),
    ["realtime.ready"],
  );
});

test("registry preserva escopo privado durante backpressure", () => {
  const registry = new GameRealtimeRegistry();
  const target = fakeSocket();
  const other = fakeSocket();
  registry.add(target, { roomId: "12", playerId: "7" });
  registry.add(other, { roomId: "12", playerId: "8" });
  registry.sendReady(target, 5);
  registry.sendReady(other, 5);

  target.bufferedAmount = 100_000;
  registry.broadcastInvalidation("12", 6, "7");
  registry.broadcastInvalidation("12", 8, "7");
  assert.equal(target.sent.length, 1);
  assert.equal(other.sent.length, 1);

  target.bufferedAmount = 0;
  registry.heartbeat();

  assert.equal(target.sent.at(-1).type, "game.private.invalidate");
  assert.equal(target.sent.at(-1).payload.revision, 8);
  assert.equal(other.sent.length, 1);
});

test("registry entrega patch somente quando baseRevision é contínua", () => {
  const registry = new GameRealtimeRegistry();
  const socket = fakeSocket();
  registry.add(socket, { roomId: "12", playerId: "7" });
  registry.sendReady(socket, 4);

  registry.broadcastPatch({
    kind: "patch",
    scope: "room",
    roomId: "12",
    baseRevision: 4,
    revision: 5,
    patch: { territories: [{ territoryId: 2, troops: 3 }] },
  });

  assert.equal(socket.sent.at(-1).type, "game.patch");
  assert.equal(socket.sent.at(-1).payload.baseRevision, 4);
  assert.equal(socket.sent.at(-1).payload.revision, 5);

  registry.broadcastPatch({
    kind: "patch",
    scope: "room",
    roomId: "12",
    baseRevision: 6,
    revision: 7,
    patch: { territories: [{ territoryId: 2, troops: 4 }] },
  });

  assert.equal(socket.sent.at(-1).type, "game.invalidate");
  assert.equal(socket.sent.at(-1).payload.revision, 7);
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

test("patch congestionado é descartado em favor da revision mais nova", () => {
  const registry = new GameRealtimeRegistry();
  const socket = fakeSocket();
  registry.add(socket, { roomId: "12", playerId: "7" });
  registry.sendReady(socket, 4);

  socket.bufferedAmount = 100_000;
  registry.broadcastPatch({
    kind: "patch",
    scope: "room",
    roomId: "12",
    baseRevision: 4,
    revision: 5,
    patch: { territories: [{ territoryId: 2, troops: 3 }] },
  });
  assert.equal(socket.sent.length, 1);

  socket.bufferedAmount = 0;
  registry.heartbeat();

  assert.equal(socket.sent.at(-1).type, "game.invalidate");
  assert.equal(socket.sent.at(-1).payload.revision, 5);
});
