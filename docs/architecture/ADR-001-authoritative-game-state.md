# ADR-001 — Authoritative Game State

## Status
Accepted.

## Decision
PostgreSQL is the sole authoritative source of persistent game state.

Client state, localStorage, realtime transports, caches and process memory may represent or accelerate access to game state, but must never define authoritative gameplay outcomes.

All gameplay mutations continue through server command boundaries and database transactions.

## Consequences
- Losing a client or realtime connection cannot corrupt a match.
- Recovery can always rebuild client state from the database-backed snapshot.
- Future Redis or WebSocket layers remain replaceable infrastructure.
