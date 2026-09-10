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

## CPG generator

Joern is pinned in `joern.lock.json`. The generator stages only the configured source files and invokes the JavaScript/TypeScript frontend through `joern-parse`.

If a compatible Joern installation already exists:

```bash
JOERN_HOME=/path/to/joern ./scripts/context/build-cpg.sh
```

To download the pinned official distribution into the ignored cache:

```bash
CPG_BOOTSTRAP_JOERN=1 ./scripts/context/build-cpg.sh
```

The official Joern distribution is large, so bootstrap is opt-in. Downloaded archives are SHA-256 verified and cached under `.context/cache/joern/`.

The bootstrap path supports Linux and macOS on x86_64 and arm64. Other environments may provide a compatible installation through `JOERN_HOME`.

## Generated data

`.context/cpg/` and `.context/cache/` are generated and ignored by Git. The generated graph is written to `.context/cpg/cpg.bin`; build metadata is written beside it.

Source code is always the source of truth. Generated graph data must never be edited manually.

CPG query helpers and stale-graph detection are intentionally left for the next integration phases.
