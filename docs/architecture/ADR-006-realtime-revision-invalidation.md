# ADR-006 — Realtime Revision Invalidation

## Status
Accepted.

## Decision
Phase 2 realtime carries revision invalidations, readiness and clock samples only. PostgreSQL snapshots remain authoritative and HTTP remains the recovery path.

A gameplay mutation commits first. After commit, the command boundary attempts a best-effort PostgreSQL `pg_notify`. Notification failure is observable but never changes the successful gameplay result.

The client rollout has three modes:
- `off`: HTTP polling only.
- `shadow`: WebSocket is observed and measured but never requires a revision or wakes synchronization.
- `hybrid`: `realtime.ready` and `game.invalidate` require the announced revision and wake the existing HTTP snapshot sync.

Hybrid watchdog polling is reduced only while the socket is connected and no automatic presentation/bot advance is pending. Any degraded socket state restores the previous polling policy.

## Consequences
- WebSocket, gateway and LISTEN/NOTIFY failures reduce responsiveness but not correctness.
- Reconnect recovery is state-based through an authoritative snapshot rather than mandatory event replay.
- Revisions can be coalesced under backpressure because only the highest unseen revision matters.
- Realtime gateway process memory stores connections only, never authoritative game state.
