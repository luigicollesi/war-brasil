import assert from "node:assert/strict";
import test from "node:test";
import {
  GAME_REALTIME_SUBPROTOCOL,
  parseClientMessage,
  parseNotificationPayload,
  serverEvent,
} from "../protocol.mjs";

test("protocol mantém subprotocolo v2 e valida notification mínima", () => {
  assert.equal(GAME_REALTIME_SUBPROTOCOL, "war-brasil.v2");
  assert.deepEqual(
    parseNotificationPayload(JSON.stringify({ roomId: "12", revision: 4 })),
    { kind: "invalidate", scope: "room", roomId: "12", revision: 4 },
  );
  assert.deepEqual(
    parseNotificationPayload(
      JSON.stringify({ kind: "invalidate", roomId: "12", revision: 5 }),
    ),
    { kind: "invalidate", scope: "room", roomId: "12", revision: 5 },
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

test("protocol valida escopo privado e exige playerId", () => {
  assert.deepEqual(
    parseNotificationPayload(
      JSON.stringify({
        kind: "invalidate",
        scope: "player",
        roomId: "12",
        playerId: "7",
        revision: 5,
      }),
    ),
    {
      kind: "invalidate",
      scope: "player",
      roomId: "12",
      playerId: "7",
      revision: 5,
    },
  );

  assert.equal(
    parseNotificationPayload(
      JSON.stringify({
        kind: "invalidate",
        scope: "player",
        roomId: "12",
        revision: 5,
      }),
    ),
    null,
  );

  assert.equal(
    parseNotificationPayload(
      JSON.stringify({
        kind: "invalidate",
        scope: "room",
        roomId: "12",
        playerId: "7",
        revision: 5,
      }),
    ),
    null,
  );
});

test("protocol aceita patch público v2 completo e rejeita campos privados", () => {
  const patch = parseNotificationPayload(
    JSON.stringify({
      kind: "patch",
      scope: "room",
      roomId: "12",
      baseRevision: 4,
      revision: 5,
      patch: {
        room: {
          phase: "attack",
          currentPlayerId: "7",
          turnNumber: 3,
          roundNumber: 2,
          jurassicTunnelDestinationId: 14,
          reinforcementsRemaining: 0,
          automaticAdvancePending: false,
          pendingConquest: { fromTerritoryId: 2, toTerritoryId: 3 },
          battle: {
            attacker: [6, 4],
            defender: [5],
            attackerLosses: 0,
            defenderLosses: 1,
            conquered: false,
            attackerTerritoryId: 2,
            defenderTerritoryId: 3,
            attackerPlayerId: "7",
            defenderPlayerId: "8",
            stage: "show_battle_result",
            stageStartedAt: "2026-09-06T07:00:00.000Z",
            attackMode: "normal",
            barrierName: null,
            attackerTroopsAfter: 5,
            defenderTroopsAfter: 1,
          },
        },
        territories: [
          {
            territoryId: 3,
            ownerPlayerId: "7",
            ownerColor: "forest",
            troops: 2,
            movedInTurn: 0,
          },
        ],
      },
    }),
  );

  assert.equal(patch.kind, "patch");
  assert.equal(patch.scope, "room");
  assert.equal(patch.baseRevision, 4);
  assert.equal(patch.revision, 5);
  assert.equal(patch.patch.room.currentPlayerId, "7");
  assert.equal(patch.patch.room.battle.stage, "show_battle_result");
  assert.equal(patch.patch.territories[0].ownerColor, "forest");

  assert.equal(
    parseNotificationPayload(
      JSON.stringify({
        kind: "patch",
        scope: "room",
        roomId: "12",
        baseRevision: 4,
        revision: 5,
        patch: { myCards: [{ id: "1" }] },
      }),
    ),
    null,
  );
  assert.equal(
    parseNotificationPayload(
      JSON.stringify({
        kind: "patch",
        scope: "room",
        roomId: "12",
        baseRevision: 5,
        revision: 5,
        patch: { territories: [{ territoryId: 7, troops: 4 }] },
      }),
    ),
    null,
  );
});

test("protocol aceita patches parciais de ownership sem exigir troops", () => {
  const patch = parseNotificationPayload(
    JSON.stringify({
      kind: "patch",
      scope: "room",
      roomId: "12",
      baseRevision: 5,
      revision: 6,
      patch: {
        territories: [
          {
            territoryId: 9,
            ownerPlayerId: "8",
            ownerColor: "ocean",
          },
        ],
      },
    }),
  );

  assert.equal(patch.kind, "patch");
  assert.equal(patch.patch.territories[0].ownerPlayerId, "8");
  assert.equal(patch.patch.territories[0].ownerColor, "ocean");
});

test("protocol rejeita patch com escopo privado", () => {
  assert.equal(
    parseNotificationPayload(
      JSON.stringify({
        kind: "patch",
        scope: "player",
        playerId: "7",
        roomId: "12",
        baseRevision: 4,
        revision: 5,
        patch: { territories: [{ territoryId: 7, troops: 4 }] },
      }),
    ),
    null,
  );
});

test("protocol aceita patch privado somente no escopo do jogador", () => {
  const event = parseNotificationPayload(
    JSON.stringify({
      kind: "private_patch",
      scope: "player",
      playerId: "7",
      roomId: "12",
      baseRevision: 5,
      revision: 6,
      patch: {
        myCards: [{ id: "41", territoryId: null, symbol: "wild" }],
      },
    }),
  );

  assert.equal(event.kind, "patch");
  assert.equal(event.scope, "player");
  assert.equal(event.playerId, "7");
  assert.equal(event.patch.myCards[0].id, "41");
});

test("protocol aceita resolução efêmera de negociação e rejeita outcome inválido", () => {
  const event = parseNotificationPayload(
    JSON.stringify({
      kind: "ephemeral",
      scope: "room",
      roomId: "12",
      eventId: "resolution-1",
      eventType: "trade.resolution",
      payload: {
        offerId: "9",
        turnNumber: 3,
        recipientPlayerId: "4",
        actorPlayerId: "7",
        outcome: "declined",
      },
    }),
  );

  assert.equal(event.kind, "ephemeral");
  assert.equal(event.eventType, "trade.resolution");
  assert.equal(event.payload.offerId, "9");
  assert.equal(event.payload.recipientPlayerId, "4");

  assert.equal(
    parseNotificationPayload(
      JSON.stringify({
        kind: "ephemeral",
        scope: "room",
        roomId: "12",
        eventId: "resolution-2",
        eventType: "trade.resolution",
        payload: {
          offerId: "9",
          turnNumber: 3,
          recipientPlayerId: "4",
          actorPlayerId: "7",
          outcome: "ignored",
        },
      }),
    ),
    null,
  );
});

test("protocol aceita apenas ping v2 da própria sala", () => {
  const message = JSON.stringify({
    protocolVersion: 2,
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

  assert.equal(
    parseClientMessage(
      JSON.stringify({
        protocolVersion: 1,
        type: "realtime.ping",
        roomId: "12",
        clientTime: 1000,
        nonce: "legacy",
      }),
      "12",
    ),
    null,
  );
});

test("server event inclui versão v2, sala e serverTime", () => {
  const event = JSON.parse(serverEvent("game.invalidate", "12", { revision: 5 }));
  assert.equal(event.protocolVersion, 2);
  assert.equal(event.roomId, "12");
  assert.equal(event.payload.revision, 5);
  assert.equal(typeof event.serverTime, "number");
});
