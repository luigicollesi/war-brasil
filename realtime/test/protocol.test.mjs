import assert from "node:assert/strict";
import test from "node:test";
import {
  GAME_REALTIME_SUBPROTOCOL,
  parseClientMessage,
  parseNotificationPayload,
  serverEvent,
} from "../protocol.mjs";

test("protocol mantém subprotocolo v1 e valida notification mínima", () => {
  assert.equal(GAME_REALTIME_SUBPROTOCOL, "war-brasil.v1");
  assert.deepEqual(
    parseNotificationPayload(JSON.stringify({ roomId: "12", revision: 4 })),
    { roomId: "12", revision: 4 },
  );
  assert.equal(
    parseNotificationPayload(JSON.stringify({ roomId: "x", revision: 4 })),
    null,
  );
  assert.equal(
    parseNotificationPayload(JSON.stringify({ roomId: "12", revision: 0 })),
    null,
  );
});

test("protocol aceita apenas ping da própria sala", () => {
  const message = JSON.stringify({
    protocolVersion: 1,
    type: "realtime.ping",
    roomId: "12",
    clientTime: 1000,
    nonce: "n1",
  });

  assert.deepEqual(parseClientMessage(message, "12"), {
    type: "realtime.ping",
    roomId: "12",
    clientTime: 1000,
    nonce: "n1",
  });
  assert.equal(parseClientMessage(message, "13"), null);
});

test("server event inclui versão, sala e serverTime", () => {
  const event = JSON.parse(serverEvent("game.invalidate", "12", { revision: 5 }));
  assert.equal(event.protocolVersion, 1);
  assert.equal(event.roomId, "12");
  assert.equal(event.payload.revision, 5);
  assert.equal(typeof event.serverTime, "number");
});
