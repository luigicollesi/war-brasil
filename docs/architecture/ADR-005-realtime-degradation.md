# ADR-005 — Realtime Degradation

## Status
Accepted.

## Decision
Realtime communication is an optimization layer, not a prerequisite for game correctness.

If realtime transport is unavailable, clients must be able to fall back to HTTP snapshot synchronization. The polling path remains supported until an explicitly tested replacement preserves the same recovery guarantees.

## Consequences
- Realtime outages reduce responsiveness instead of breaking matches.
- Rollout can progress through `off`, `shadow` and `hybrid` modes.
- Infrastructure can be disabled quickly without reverting domain changes.
