import assert from "node:assert/strict";
import test from "node:test";
import {
  GAME_PROTOCOL_VERSION,
  isGameRealtimeEvent,
} from "../.test-build/shared/game-realtime-contract.js";

const base = {
  protocolVersion: GAME_PROTOCOL_VERSION,
  type: "trade.signal",
  roomId: "42",
  serverTime: 1_788_480_000_000,
};

for (const card of [
  { kind: "territory", territoryId: 12 },
  { kind: "symbol", symbol: "leaf" },
  { kind: "wild" },
]) {
  test(`trade.signal aceita descritor ${card.kind}`, () => {
    assert.equal(
      isGameRealtimeEvent({
        ...base,
        payload: {
          playerId: "7",
          turnNumber: 4,
          card,
        },
      }),
      true,
    );
  });
}

test("trade.signal rejeita símbolo inválido", () => {
  assert.equal(
    isGameRealtimeEvent({
      ...base,
      payload: {
        playerId: "7",
        turnNumber: 4,
        card: { kind: "symbol", symbol: "ruby" },
      },
    }),
    false,
  );
});
