import assert from "node:assert/strict";
import test from "node:test";
import { cleanupStaleLobbies } from "../lobby-cleanup-client.mjs";

test("worker calls protected lobby cleanup endpoint", async () => {
  let request = null;
  const result = await cleanupStaleLobbies({
    baseUrl: "https://war.example.com/",
    token: "secret",
    signal: new AbortController().signal,
    fetchImpl: async (url, init) => {
      request = { url, init };
      return {
        ok: true,
        status: 200,
        async json() {
          return { removedSeats: 2, affectedRooms: 2, deletedRooms: 1 };
        },
      };
    },
  });

  assert.equal(request.url, "https://war.example.com/api/internal/lobby/cleanup");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, "Bearer secret");
  assert.deepEqual(result, {
    removedSeats: 2,
    affectedRooms: 2,
    deletedRooms: 1,
  });
});
