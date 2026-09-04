# ADR-003 — Transport Independence

## Status
Accepted.

## Decision
Gameplay domain rules must not depend directly on HTTP, WebSocket, Redis, WebTransport or any other transport technology.

Client synchronization depends on transport interfaces. The current snapshot implementation is HTTP and the current realtime implementation is a null transport.

## Consequences
- Realtime can be introduced or replaced without rewriting game rules.
- Web, Electron and Capacitor can share the same protocol and authoritative backend.
- Transport failures degrade synchronization performance rather than domain correctness.
