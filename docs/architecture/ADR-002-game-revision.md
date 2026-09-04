# ADR-002 — Game Revision

## Status
Accepted.

## Decision
Each authoritative state mutation advances the room revision monotonically. Commands that depend on a known state continue to validate `expectedRevision` or `baseRevision` before applying changes.

Clients never apply a patch unless its base revision exactly matches the currently observed revision.

## Consequences
- Concurrent commands are fenced by the authoritative room revision.
- Stale responses and duplicate updates can be rejected deterministically.
- A revision gap triggers snapshot recovery instead of speculative reconstruction.
