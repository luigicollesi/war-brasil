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

The CPG generator and query commands will be added in the next integration phase.
