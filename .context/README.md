# Code context

This directory contains versioned configuration for generated code-navigation artifacts.

## CPG scope

The canonical scope is defined in `cpg.config.json`.

The initial graph covers application/runtime code under:

- `src/`
- `realtime/`
- `worker/`
- `scripts/`

Tests are intentionally excluded from the initial CPG to keep the graph focused on production/runtime relationships. They remain available to agents as source and may be indexed separately later if useful.

Repository documentation, agent skills, GitHub workflows, static assets and map reference images are outside the CPG roots and therefore are not indexed.

## Generated data

`.context/cpg/` and `.context/cache/` are generated and ignored by Git. Source code is always the source of truth; generated graph data must never be edited manually.

The source staging manifest records SHA-256 fingerprints for the selected source contents and the effective CPG configuration. The CPG build metadata also records the pinned Joern lock fingerprint. These values allow agents and CI to detect stale graphs even when the file names have not changed.

## Build and status commands

Prepare the exact source set without requiring Joern:

```bash
npm run context:cpg:prepare
```

Build the CPG with an existing compatible Joern installation:

```bash
JOERN_HOME=/path/to/joern npm run context:cpg:build
```

Or explicitly bootstrap the pinned Joern release into the ignored cache before building:

```bash
CPG_BOOTSTRAP_JOERN=1 npm run context:cpg:build
```

Check whether the generated graph matches the current source, configuration and Joern lock:

```bash
npm run context:cpg:status
```

Machine-readable output:

```bash
npm run context:cpg:status -- --json
```

For CI or scripts that must fail when the graph is not current:

```bash
npm run context:cpg:status -- --check
```

Status meanings:

- `CURRENT`: the CPG exists and its source/config/tool fingerprints match the current repository state.
- `STALE`: a CPG exists, but indexed source, configuration, metadata schema or the pinned Joern definition changed.
- `MISSING`: `cpg.bin` or its build metadata is absent or unusable.

The stored commit SHA is informational. A commit that changes only files outside the CPG scope does not invalidate a graph; content fingerprints are the authority for freshness.

## Query commands

Queries require a `CURRENT` CPG. They return compact JSON intended for agents and scripts. Symbol matching is exact against Joern method `name` or `fullName`; run the symbol query first when a name may be ambiguous.

Find method definitions represented by a symbol:

```bash
npm run context:cpg:symbol -- GameMap
```

Find direct callers or callees:

```bash
npm run context:cpg:callers -- resolveAttack
npm run context:cpg:callees -- resolveAttack
```

Inspect bounded upstream and downstream call-graph impact. The default depth is 2 and the accepted range is 1-20:

```bash
npm run context:cpg:impact -- resolveAttack --depth 3
```

Find the shortest directed call-graph path between two symbols. The default maximum depth is 8:

```bash
npm run context:cpg:path -- RealtimeClient GameMap --depth 10
```

The query layer refuses to run when the graph is `MISSING` or `STALE`. Rebuild first instead of using stale structural information.

`JOERN_BIN` may point directly to the `joern` executable. `JOERN_HOME` may point to a Joern installation directory. When neither is supplied, queries reuse the pinned Joern runtime under `.context/cache/joern/` if it was bootstrapped during a CPG build.
