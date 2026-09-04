import assert from "node:assert/strict";
import test from "node:test";
import { parseCookieHeader, readRealtimeIdentity } from "../auth.mjs";

test("cookie parser preserva sessão do jogador", () => {
  const cookies = parseCookieHeader(
    "other=x; war_brasil_player=123e4567-e89b-12d3-a456-426614174000; theme=dark",
  );
  assert.equal(
    cookies.get("war_brasil_player"),
    "123e4567-e89b-12d3-a456-426614174000",
  );
});

test("identity é resolvida pelo vínculo room + player_session", async () => {
  let receivedParams = null;
  const pool = {
    async query(_sql, params) {
      receivedParams = params;
      return {
        rows: [{ player_id: "77", revision: 15 }],
      };
    },
  };

  const identity = await readRealtimeIdentity(
    pool,
    "12",
    "war_brasil_player=123e4567-e89b-12d3-a456-426614174000",
  );

  assert.deepEqual(receivedParams, [
    "12",
    "123e4567-e89b-12d3-a456-426614174000",
  ]);
  assert.deepEqual(identity, {
    playerId: "77",
    revision: 15,
    session: "123e4567-e89b-12d3-a456-426614174000",
  });
});

test("identity rejeita ausência de cookie sem consultar banco", async () => {
  let queries = 0;
  const pool = {
    async query() {
      queries += 1;
      return { rows: [] };
    },
  };

  assert.equal(await readRealtimeIdentity(pool, "12", "theme=dark"), null);
  assert.equal(queries, 0);
});
