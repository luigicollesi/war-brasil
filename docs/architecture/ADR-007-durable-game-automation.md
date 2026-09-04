# ADR-007 — Durable game automation

## Status

Accepted for Phase 3 rollout.

## Decision

Automatic game progress is scheduled from persisted PostgreSQL state. `game_rooms.automation_due_at` points to the next automatic transition and `automation_kind` classifies it as presentation or bot work.

The schedule is reconciled while the room is already locked by the authoritative command transaction. Scheduling metadata does not define gameplay state and must not increment the room revision by itself.

Presentation deadlines are derived from the same transition constants used by gameplay. Bot deadlines continue to use `bot_next_action_at` and the existing bot delay rules.

The worker rollout is `off -> shadow -> active`. Shadow mode may observe due work but cannot mutate game state. Active execution is not enabled until concurrency and recovery behavior are validated.

## Consequences

- Browsers can later stop driving `/advance` without changing game rules.
- No authoritative `setTimeout` or per-room in-memory timer is required.
- Worker restarts cannot erase the schedule.
- PostgreSQL remains the sole source of truth.
- Realtime remains a delivery optimization after the worker commits a revision.
