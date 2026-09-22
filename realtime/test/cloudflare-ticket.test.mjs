import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";
import {
  realtimeTicketSecretConfigured,
  verifyGameRealtimeTicket,
  verifyUserRealtimeTicket,
} from "../cloudflare/ticket.mjs";

const secret = "0123456789abcdef0123456789abcdef";

function signedTicket(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

test("Cloudflare verifier accepts revision-bearing game tickets issued by Next", async () => {
  const now = 1_788_480_000_000;
  const ticket = signedTicket({
    v: 2,
    roomId: "42",
    playerId: "7",
    revision: 33,
    exp: now + 45_000,
    nonce: randomUUID(),
  });

  const payload = await verifyGameRealtimeTicket(ticket, secret, "42", now);
  assert.equal(payload?.playerId, "7");
  assert.equal(payload?.revision, 33);
  assert.equal(
    await verifyGameRealtimeTicket(ticket, secret, "43", now),
    null,
  );
});

test("Cloudflare verifier accepts user tickets and rejects weak secrets", async () => {
  const now = 1_788_480_000_000;
  const userId = "123e4567-e89b-42d3-a456-426614174000";
  const ticket = signedTicket({
    v: 2,
    kind: "user",
    userId,
    exp: now + 45_000,
    nonce: randomUUID(),
  });

  assert.equal(
    (await verifyUserRealtimeTicket(ticket, secret, now))?.userId,
    userId,
  );
  assert.equal(await verifyUserRealtimeTicket(ticket, "short", now), null);
  assert.equal(realtimeTicketSecretConfigured(secret), true);
  assert.equal(realtimeTicketSecretConfigured("short"), false);
});
