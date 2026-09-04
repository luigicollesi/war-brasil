import assert from "node:assert/strict";
import test from "node:test";
import { advanceDueAutomation } from "../advance-client.mjs";

function response({ ok = true, status = 200, data = {} } = {}) {
  return {
    ok,
    status,
    async json() {
      return data;
    },
  };
}

test("worker envia somente roomId e expectedRevision ao endpoint interno", async () => {
  let request = null;
  const result = await advanceDueAutomation({
    row: { room_id: "42", revision: 17 },
    baseUrl: "https://war.example.com/",
    token: "secret",
    signal: new AbortController().signal,
    fetchImpl: async (url, init) => {
      request = { url, init };
      return response({ data: { changed: true, revision: 18, kind: "acted" } });
    },
  });

  assert.equal(request.url, "https://war.example.com/api/internal/automation/advance");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, "Bearer secret");
  assert.deepEqual(JSON.parse(request.init.body), {
    roomId: "42",
    expectedRevision: 17,
  });
  assert.deepEqual(result, { changed: true, revision: 18, kind: "acted" });
});

test("resposta stale/no-op não é convertida em nova mutação pelo worker", async () => {
  const result = await advanceDueAutomation({
    row: { room_id: "42", revision: 17 },
    baseUrl: "http://127.0.0.1:3000",
    token: "secret",
    signal: new AbortController().signal,
    fetchImpl: async () =>
      response({ data: { changed: false, revision: 18, kind: null } }),
  });

  assert.deepEqual(result, { changed: false, revision: 18, kind: null });
});

test("erro HTTP do backend falha fechado e preserva a mensagem sanitizada", async () => {
  await assert.rejects(
    () =>
      advanceDueAutomation({
        row: { room_id: "42", revision: 17 },
        baseUrl: "http://127.0.0.1:3000",
        token: "secret",
        signal: new AbortController().signal,
        fetchImpl: async () =>
          response({ ok: false, status: 503, data: { error: "indisponível" } }),
      }),
    /indisponível/,
  );
});
