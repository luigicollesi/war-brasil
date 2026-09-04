import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";
import { GAME_PROTOCOL_VERSION } from "../protocol.mjs";
import { realtimeTicketConfigured, verifyRealtimeTicket } from "../ticket.mjs";

const secret = "0123456789abcdef0123456789abcdef";

function ticket(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

test("ticket realtime valida assinatura, sala, versão e expiração", () => {
  const now = 1_788_480_000_000;
  const value = ticket({
    v: GAME_PROTOCOL_VERSION,
    roomId: "42",
    playerId: "7",
    exp: now + 45_000,
    nonce: randomUUID(),
  });

  assert.equal(
    verifyRealtimeTicket(value, "42", { now, secret })?.playerId,
    "7",
  );
  assert.equal(verifyRealtimeTicket(value, "43", { now, secret }), null);
  assert.equal(verifyRealtimeTicket(value, "42", { now: now + 46_000, secret }), null);
  assert.equal(verifyRealtimeTicket(`${value}x`, "42", { now, secret }), null);
});

test("ticket realtime exige segredo forte quando configurado por ambiente", () => {
  assert.equal(realtimeTicketConfigured({}), false);
  assert.equal(
    realtimeTicketConfigured({ GAME_REALTIME_TICKET_SECRET: "short" }),
    false,
  );
  assert.equal(
    realtimeTicketConfigured({ GAME_REALTIME_TICKET_SECRET: secret }),
    true,
  );
});
