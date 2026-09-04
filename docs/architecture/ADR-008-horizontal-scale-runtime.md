# ADR-008 — Horizontal scale runtime

## Status

Accepted for Phase 4 rollout.

## Decision

PostgreSQL remains the sole authoritative game state and the durable source for automation schedules. Horizontal scale is added around that authority rather than by moving gameplay state into Redis or gateway memory.

Realtime publication is behind the `GameRealtimeBus` boundary. PostgreSQL `NOTIFY` remains the default publication path. During the Redis rollout, a dedicated relay can consume the existing PostgreSQL notification stream and publish the same validated event to versioned Redis Pub/Sub channels scoped by room (`war:game:<roomId>:v1`). Gateways configured with `GAME_REALTIME_EVENT_SOURCE=redis` subscribe only while they have local sockets for that room and unsubscribe when the last local socket leaves.

Redis Pub/Sub is intentionally ephemeral. Lost or duplicated delivery is repaired by the existing revision rules, HTTP snapshot recovery and watchdog polling. Redis must never store authoritative troops, cards, objectives, turns or revisions.

Automation workers claim due rooms in PostgreSQL with `FOR UPDATE SKIP LOCKED` and an expiring lease (`automation_claimed_by`, `automation_claimed_until`). Claims prevent duplicate work across worker instances; `expectedRevision` remains the correctness fence. A crashed worker leaves a lease that another worker may recover after expiry.

Realtime gateways expose separate liveness and readiness. During shutdown they stop accepting upgrades before closing existing sockets with a retryable service-restart code. Sticky sessions are not required because connection state is local-only and canonical recovery is state-based.

For cross-host gateways and future Electron/Capacitor clients, short-lived HMAC-signed realtime tickets are supported. Tickets contain protocol version, room id, player id, expiration and nonce only. The gateway revalidates the player/room membership in PostgreSQL before confirming `realtime.ready`. Cookie authentication remains the default rollout mode.

An optional `GameEphemeralTransport` boundary exists for future cosmetic/discardable traffic. It is disabled by default and may never carry gameplay commands, authoritative patches, required revisions or private state needed for reconstruction.

## Consequences

- Multiple gateways can serve the same room without shared socket memory or sticky sessions.
- Multiple automation workers can run without intentionally executing the same due room.
- Redis outage reduces realtime availability but cannot corrupt or block authoritative gameplay.
- Gateway or worker restarts do not lose game state or schedules.
- PostgreSQL remains sufficient to reconstruct the game after any ephemeral infrastructure loss.
- A future direct Redis publisher can replace the transitional relay behind the bus boundary without changing gameplay services.
