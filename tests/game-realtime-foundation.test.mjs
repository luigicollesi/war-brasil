import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GamePollScheduler } from "../.test-build/client/sync/game-poll-scheduler.js";
import { RevisionCoordinator } from "../.test-build/client/sync/revision-coordinator.js";
import {
  GAME_PROTOCOL_VERSION,
  isGameRealtimeEvent,
} from "../.test-build/shared/game-realtime-contract.js";

test("revision coordinator mantém revisão monotônica e satisfaz revisão requerida", () => {
  const revisions = new RevisionCoordinator();

  assert.equal(revisions.current(), null);
  revisions.observe(4);
  revisions.observe(3);
  assert.equal(revisions.current(), 4);

  revisions.require(6);
  assert.equal(revisions.needsRequiredRevision(), true);
  revisions.observe(5);
  assert.equal(revisions.needsRequiredRevision(), true);
  revisions.observe(6);
  assert.equal(revisions.needsRequiredRevision(), false);
  assert.equal(revisions.hasObserved(6), true);
});

test("revision coordinator aplica patch somente sobre a revisão base exata", () => {
  const revisions = new RevisionCoordinator();
  revisions.observe(10);

  assert.equal(revisions.canApplyPatch(10, 11), true);
  assert.equal(revisions.canApplyPatch(9, 11), false);
  assert.equal(revisions.canApplyPatch(10, 10), false);
  assert.equal(revisions.canApplyPatch(null, 11), false);
});

test("scheduler preserva polling atual e backoff sem depender do hook", () => {
  const scheduler = new GamePollScheduler();

  assert.equal(
    scheduler.nextDelay({
      visible: true,
      online: true,
      presentationPending: false,
    }),
    1_000,
  );

  scheduler.recordFailure();
  assert.equal(
    scheduler.nextDelay({
      visible: true,
      online: true,
      presentationPending: false,
    }),
    2_000,
  );

  scheduler.recordSuccess();
  assert.equal(
    scheduler.nextDelay({
      visible: false,
      online: true,
      presentationPending: false,
    }),
    5_000,
  );
});

test("protocolo realtime é versionado e rejeita envelopes inválidos", () => {
  const valid = {
    protocolVersion: GAME_PROTOCOL_VERSION,
    type: "game.invalidate",
    roomId: "42",
    serverTime: Date.now(),
    payload: { revision: 7 },
  };

  assert.equal(isGameRealtimeEvent(valid), true);
  assert.equal(
    isGameRealtimeEvent({ ...valid, protocolVersion: GAME_PROTOCOL_VERSION + 1 }),
    false,
  );
  assert.equal(
    isGameRealtimeEvent({ ...valid, payload: { revision: 0 } }),
    false,
  );
});

test("hook delega transporte, revisão e topologia ao controller", () => {
  const hook = readFileSync("src/hooks/use-game-sync.ts", "utf8");
  const controller = readFileSync(
    "src/lib/client/sync/game-sync-controller.ts",
    "utf8",
  );
  const snapshotTransport = readFileSync(
    "src/lib/client/transport/http-game-snapshot-transport.ts",
    "utf8",
  );
  const snapshotCoordinator = readFileSync(
    "src/lib/client/sync/game-snapshot-coordinator.ts",
    "utf8",
  );

  assert.match(hook, /new GameSyncController\(roomId\)/);
  assert.match(hook, /new GamePollScheduler\(\)/);
  assert.doesNotMatch(hook, /revisionRef|requiredRevisionRef|topologyVersionRef/);
  assert.doesNotMatch(hook, /hydrateGameSnapshot|shareGameSnapshot/);

  assert.match(controller, /HttpGameSnapshotTransport/);
  assert.match(controller, /NullGameRealtimeTransport/);
  assert.match(controller, /RevisionCoordinator/);
  assert.match(snapshotTransport, /response\.status === 204/);
  assert.match(snapshotTransport, /GAME_REVISION_HEADER/);
  assert.match(snapshotTransport, /GAME_TOPOLOGY_HEADER/);
  assert.match(snapshotCoordinator, /hydrateGameSnapshot/);
  assert.match(snapshotCoordinator, /shareGameSnapshot/);
});

test("camada autoritativa não depende de tecnologias realtime", () => {
  const command = readFileSync("src/lib/server/game-command.ts", "utf8");
  const sharedProtocol = readFileSync(
    "src/lib/shared/game-realtime-contract.ts",
    "utf8",
  );

  assert.doesNotMatch(command, /WebSocket|Socket\.IO|socket\.io|Redis|WebTransport/i);
  assert.doesNotMatch(sharedProtocol, /window|document|WebSocket|Redis|server-only/);
});
