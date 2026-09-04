import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GameServerClock } from "../.test-build/client/sync/game-server-clock.js";
import { GamePollScheduler } from "../.test-build/client/sync/game-poll-scheduler.js";
import {
  GAME_PROTOCOL_VERSION,
  GAME_REALTIME_SUBPROTOCOL,
  isGameRealtimeClientMessage,
  isGameRealtimeEvent,
} from "../.test-build/shared/game-realtime-contract.js";

test("protocolo realtime v1 aceita ready, invalidate, pong e ping válidos", () => {
  const base = {
    protocolVersion: GAME_PROTOCOL_VERSION,
    roomId: "42",
    serverTime: 1_788_480_000_000,
  };

  assert.equal(GAME_REALTIME_SUBPROTOCOL, "war-brasil.v1");
  assert.equal(
    isGameRealtimeEvent({
      ...base,
      type: "realtime.ready",
      payload: { revision: 8 },
    }),
    true,
  );
  assert.equal(
    isGameRealtimeEvent({
      ...base,
      type: "game.invalidate",
      payload: { revision: 9 },
    }),
    true,
  );
  assert.equal(
    isGameRealtimeEvent({
      ...base,
      type: "realtime.pong",
      payload: { clientTime: 1000, nonce: "abc" },
    }),
    true,
  );
  assert.equal(
    isGameRealtimeClientMessage({
      protocolVersion: GAME_PROTOCOL_VERSION,
      type: "realtime.ping",
      roomId: "42",
      clientTime: 1000,
      nonce: "abc",
    }),
    true,
  );
});

test("server clock estima RTT e offset sem alterar relógio autoritativo", () => {
  const clock = new GameServerClock();
  const sample = clock.recordSample(1_000, 1_060, 1_100);

  assert.equal(sample.rttMs, 100);
  assert.equal(sample.offsetMs, 10);
  assert.equal(clock.serverNow(2_000), 2_010);
});

test("hybrid reduz polling somente com realtime saudável e sem automação pendente", () => {
  const scheduler = new GamePollScheduler();
  const base = {
    visible: true,
    online: true,
    presentationPending: false,
  };

  assert.equal(
    scheduler.nextDelay({
      ...base,
      realtimeMode: "hybrid",
      realtimeState: "connected",
    }),
    30_000,
  );
  assert.equal(
    scheduler.nextDelay({
      ...base,
      visible: false,
      realtimeMode: "hybrid",
      realtimeState: "connected",
    }),
    60_000,
  );
  assert.equal(
    scheduler.nextDelay({
      ...base,
      realtimeMode: "shadow",
      realtimeState: "connected",
    }),
    1_000,
  );
  assert.equal(
    scheduler.nextDelay({
      ...base,
      realtimeMode: "hybrid",
      realtimeState: "degraded",
    }),
    1_000,
  );
  assert.equal(
    scheduler.nextDelay({
      ...base,
      presentationPending: true,
      realtimeMode: "hybrid",
      realtimeState: "connected",
    }),
    1_000,
  );
});

test("publisher realtime é best-effort e acontece depois do commit autoritativo", () => {
  const command = readFileSync("src/lib/server/game-command.ts", "utf8");
  const publisher = readFileSync(
    "src/lib/server/game-realtime-publisher.ts",
    "utf8",
  );

  assert.match(command, /await client\.query\("COMMIT"\)[\s\S]*await publishGameInvalidation/);
  assert.match(command, /if \(result\.changed\) \{[\s\S]*publishGameInvalidation/);
  assert.match(command, /rollbackIfNeeded\(client, transactionOpen\)/);
  assert.match(publisher, /SELECT pg_notify\(\$1,\$2\)/);
  assert.match(publisher, /catch \(error\)/);
  assert.doesNotMatch(publisher, /throw error/);
});

test("shadow não exige revision e hybrid usa evento realtime apenas para acordar snapshot HTTP", () => {
  const controller = readFileSync(
    "src/lib/client/sync/game-sync-controller.ts",
    "utf8",
  );
  const hook = readFileSync("src/hooks/use-game-sync.ts", "utf8");

  assert.match(
    controller,
    /this\.realtimeMode === "hybrid"[\s\S]*this\.revisions\.require/,
  );
  assert.match(hook, /createGameRealtimeTransport\(realtimeMode\)/);
  assert.match(hook, /realtimeMode === "hybrid" && revisionEvent\(event\)/);
  assert.match(hook, /void wakeForRealtime\(\)/);
  assert.match(hook, /realtimeMode,[\s\S]*realtimeState/);
  assert.doesNotMatch(hook, /game\.patch.*WebSocket|WebSocket.*game\.patch/);
});

test("gateway autentica antes do upgrade, valida origem e degrada quando LISTEN cai", () => {
  const gateway = readFileSync("realtime/server.mjs", "utf8");
  const listener = readFileSync("realtime/listener.mjs", "utf8");
  const registry = readFileSync("realtime/registry.mjs", "utf8");
  const publisher = readFileSync(
    "src/lib/server/game-realtime-publisher.ts",
    "utf8",
  );
  const protocol = readFileSync("realtime/protocol.mjs", "utf8");

  assert.match(gateway, /origins\.has\(origin\)/);
  assert.match(gateway, /readRealtimeIdentity/);
  assert.match(gateway, /GAME_REALTIME_SUBPROTOCOL/);
  assert.match(gateway, /!listenerHealthy/);
  assert.match(gateway, /registry\.closeAll\(1012/);
  assert.match(listener, /LISTEN \$\{gameRealtimeChannel\(\)\}/);
  assert.match(registry, /bufferedAmount/);
  assert.match(registry, /pendingRevision = Math\.max/);
  assert.match(publisher, /war_game_revision/);
  assert.match(protocol, /war_game_revision/);
});
