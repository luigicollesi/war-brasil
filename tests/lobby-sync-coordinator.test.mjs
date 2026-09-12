import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createLobbySyncCoordinator } = require(
  "../.test-build/client/lobby-sync-coordinator.js",
);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("polling concorrente reutiliza uma única leitura em voo", async () => {
  const request = deferred();
  let calls = 0;
  const coordinator = createLobbySyncCoordinator(() => {
    calls += 1;
    return request.promise;
  });

  const first = coordinator.sync();
  const second = coordinator.sync();

  assert.equal(calls, 1);
  assert.equal(first, second);

  request.resolve();
  await first;
});

test("refresh explícito sempre inicia uma leitura depois do polling em voo", async () => {
  const firstRequest = deferred();
  const secondRequest = deferred();
  let calls = 0;

  const coordinator = createLobbySyncCoordinator(() => {
    calls += 1;
    return calls === 1 ? firstRequest.promise : secondRequest.promise;
  });

  const polling = coordinator.sync();
  const refresh = coordinator.refreshAfterCurrent();

  assert.equal(calls, 1, "refresh não deve duplicar o GET enquanto o polling ainda está em voo");

  firstRequest.resolve();
  await polling;
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls, 2, "refresh deve iniciar um GET novo depois do polling anterior terminar");

  secondRequest.resolve();
  await refresh;
});

test("falha do polling não impede retry por refresh explícito", async () => {
  const firstRequest = deferred();
  const secondRequest = deferred();
  let calls = 0;

  const coordinator = createLobbySyncCoordinator(() => {
    calls += 1;
    return calls === 1 ? firstRequest.promise : secondRequest.promise;
  });

  const polling = coordinator.sync();
  const refresh = coordinator.refreshAfterCurrent();

  firstRequest.reject(new Error("rede indisponível"));
  await assert.rejects(polling, /rede indisponível/);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls, 2);
  secondRequest.resolve();
  await refresh;
});
