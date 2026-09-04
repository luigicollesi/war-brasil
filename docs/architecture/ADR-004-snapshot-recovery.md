# ADR-004 — Snapshot Recovery

## Status
Accepted.

## Decision
A database-backed full game snapshot is the canonical recovery mechanism whenever client synchronization is uncertain.

Clients do not require event replay to restore correctness. If a revision gap, reconnect or incompatible patch is detected, the client requests an authoritative snapshot and resumes from that revision.

## Consequences
- Event delivery may be optimized without becoming a correctness dependency.
- Reconnect logic stays simple and deterministic.
- Future realtime buses may use at-most-once delivery while snapshots repair missed notifications.
