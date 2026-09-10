# CPG navigation summary

This file is the compact AI-facing map for code navigation. Source code remains the source of truth. Detailed graph relationships are trustworthy only when `npm run context:cpg:status` reports `CURRENT`.

## Current graph state

No generated `cpg.bin` is committed to Git. A fresh checkout should treat the graph as `MISSING` until it is built locally or restored by automation. Do not infer live call/data-flow relationships from this document alone.

## Runtime map

- `src/app/` — Next.js routes and UI entrypoints. Route Handlers under `src/app/api/` are HTTP adapters.
- `src/components/` — React presentation and interaction components.
- `src/hooks/` — client React hooks.
- `src/lib/shared/` — pure contracts, types, configuration and deterministic domain rules shared by client/server.
- `src/lib/client/` — browser-side synchronization, transport and client-only state.
- `src/lib/server/` — authoritative services, transactions and persistence boundaries.
- `src/lib/*.ts` — some legacy compatibility reexports; new logic belongs in `client/`, `server/` or `shared/`.
- `realtime/` — realtime gateway/delivery process; it is not authoritative game state.
- `worker/` — durable automatic game progression driven from persisted scheduling state.
- `scripts/` — finite development/database/context tooling.

## Architectural invariants

1. PostgreSQL is the sole authority for persistent gameplay state. Client state, realtime transports, caches and process memory must not define gameplay outcomes.
2. Gameplay domain rules are transport-independent. HTTP/WebSocket/realtime layers adapt or accelerate synchronization rather than define rules.
3. Gameplay mutations commit through server/database command boundaries before realtime invalidation is emitted.
4. Realtime carries revision/readiness signals; recovery remains snapshot-based from authoritative state.
5. Durable automation is scheduled from PostgreSQL state and executed by the worker; process-local timers are not authoritative.
6. `src/lib/shared` cannot depend on React, Next.js, browser, PostgreSQL, `client/` or `server/`. `client/` may depend on `shared/` but not `server/`; `server/` may depend on `shared/` but not `client/`.

## Critical flows

### Gameplay mutation and synchronization

```text
client/UI
  -> src/app/api HTTP adapter
  -> src/lib/server command/service
  -> PostgreSQL transaction + revision
  -> best-effort pg_notify
  -> realtime gateway
  -> client invalidation
  -> authoritative HTTP snapshot refresh
```

### Durable automatic progression

```text
PostgreSQL automation_due_at / automation_kind
  -> worker
  -> authoritative server command
  -> PostgreSQL transaction + revision
  -> realtime invalidation
  -> clients refresh authoritative snapshot
```

These are architecture-level paths, not substitutes for live CPG call/data-flow results.

## Progressive navigation

Use the smallest useful context and expand only when needed:

```text
task
  -> this summary
  -> context:cpg:status
  -> symbol query
  -> callers/callees/impact/path or usages/dataflow
  -> relevant source files
  -> ADRs/tests only when needed
```

Commands:

```bash
npm run context:cpg:status
npm run context:cpg:symbol -- <symbol>
npm run context:cpg:callers -- <symbol>
npm run context:cpg:callees -- <symbol>
npm run context:cpg:impact -- <symbol> --depth 2
npm run context:cpg:path -- <from> <to> --depth 8
npm run context:cpg:usages -- <variable>
npm run context:cpg:dataflow -- <sink> --depth 8
```

If status is `STALE` or `MISSING`, do not rely on graph queries. Inspect the source directly or rebuild the graph when the task justifies the cost.

## Deeper architecture references

Read only the ADRs relevant to the current task. Important starting points are:

- `docs/architecture/ADR-001-authoritative-game-state.md`
- `docs/architecture/ADR-003-transport-independence.md`
- `docs/architecture/ADR-006-realtime-revision-invalidation.md`
- `docs/architecture/ADR-007-durable-game-automation.md`
- `docs/architecture/ADR-008-horizontal-scale-runtime.md`
- `src/lib/README.md`

This summary should stay short. Do not turn it into a full repository manual or copy entire ADRs into it.
