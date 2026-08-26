import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nextGamePollDelay } from "../.test-build/game-polling.js";

test("polling adapta intervalo a visibilidade, falhas e estado offline", () => {
  assert.equal(
    nextGamePollDelay({
      visible: true,
      online: true,
      failures: 0,
      presentationPending: false,
    }),
    1_000,
  );
  assert.equal(
    nextGamePollDelay({
      visible: false,
      online: true,
      failures: 0,
      presentationPending: false,
    }),
    5_000,
  );
  assert.equal(
    nextGamePollDelay({
      visible: false,
      online: true,
      failures: 0,
      presentationPending: true,
    }),
    2_500,
  );
  assert.equal(
    nextGamePollDelay({
      visible: true,
      online: true,
      failures: 1,
      presentationPending: false,
    }),
    2_000,
  );
  assert.equal(
    nextGamePollDelay({
      visible: true,
      online: true,
      failures: 3,
      presentationPending: false,
    }),
    8_000,
  );
  assert.equal(
    nextGamePollDelay({
      visible: true,
      online: false,
      failures: 0,
      presentationPending: false,
    }),
    15_000,
  );
});

test("game sync usa scheduler adaptativo e sincroniza imediatamente ao voltar", () => {
  const source = readFileSync("src/hooks/use-game-sync.ts", "utf8");

  assert.match(source, /nextGamePollDelay/);
  assert.match(source, /document\.visibilityState/);
  assert.match(source, /consecutiveFailures/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /handleOnline/);
  assert.doesNotMatch(source, /const POLLING_INTERVAL_MS/);
});

test("snapshot preserva referências de slices inalterados", () => {
  const sharing = readFileSync("src/lib/game-snapshot-sharing.ts", "utf8");
  const sync = readFileSync("src/hooks/use-game-sync.ts", "utf8");

  assert.match(sharing, /shareGameSnapshot/);
  assert.match(sharing, /previous\.territories/);
  assert.match(sharing, /previous\.players/);
  assert.match(sharing, /previous\.connections/);
  assert.match(sharing, /return previous;/);
  assert.match(sync, /shareGameSnapshot\(/);
});

test("rede viária agrupa rotas base e individualiza somente destaques", () => {
  const source = readFileSync("src/components/road-network.tsx", "utf8");

  assert.match(source, /basePath: base\.join\(" "\)/);
  assert.match(source, /road-route-base/);
  assert.match(source, /layers\.highlighted\.map/);
  assert.match(source, /connectedToSelection \|\| reachesTarget/);
  assert.doesNotMatch(source, /roadPaths\.map\(/);
});
