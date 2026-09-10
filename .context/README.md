# Code context

This directory contains versioned configuration for generated code-navigation artifacts.

## CPG scope

The canonical scope is defined in `cpg.config.json`.

The initial graph covers application/runtime code under:

- `src/`
- `realtime/`
- `worker/`
- `scripts/`

Tests are intentionally excluded from the initial CPG to keep the graph focused on production/runtime relationships. `scripts/context/` is also excluded because it implements the graph tooling itself; indexing it would make tooling-only changes invalidate the application graph. Tests and context tooling remain available to agents as source.

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

## GitHub Actions cache and artifacts

`.github/workflows/cpg.yml` runs separately from the normal test workflow. It is triggered by pushes to `dev` when CPG-relevant source, configuration, build tooling, or the workflow itself changes, and it can also be started manually where GitHub allows `workflow_dispatch`.

The workflow:

1. prepares the canonical source set;
2. computes a combined artifact fingerprint from source, configuration and the pinned Joern lock;
3. restores the pinned Joern runtime from GitHub Actions cache when available;
4. restores an exact CPG cache when available;
5. otherwise builds the graph with the pinned Joern release;
6. requires `context:cpg:status -- --check` to pass;
7. uploads `cpg.bin` and `build.json` as a named workflow artifact.

The Joern runtime and CPG caches use exact fingerprint keys with no broad restore prefix. This avoids silently treating a stale graph as reusable. The generated CPG is never committed by the workflow.

The artifact name is deterministic:

```text
cpg-<combined fingerprint>
```

This allows a fresh agent session to recover the exact graph without downloading unrelated artifacts. With an authenticated GitHub CLI:

```bash
npm run context:cpg:restore
```

The restore command computes the current artifact identity, finds a non-expired exact-name GitHub Actions artifact, downloads it, installs only `cpg.bin` and `build.json`, and then requires the normal freshness check to pass. If no exact artifact exists or the artifact expired, build locally instead.

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

## Slice commands

Slices also require a `CURRENT` CPG and use Joern's `joern-slice` utility. They are intended for questions that the call graph alone cannot answer.

Describe how a local variable or parameter is used. The output is post-filtered to the exact requested variable and method source is omitted by default to keep context small:

```bash
npm run context:cpg:usages -- selectedTerritory
npm run context:cpg:usages -- selectedTerritory --method GameMap
npm run context:cpg:usages -- selectedTerritory --file src/components/GameMap.tsx
```

Use `--include-source` only when the surrounding method body is useful, and `--exclude-operators` when operator calls add noise.

Create a backwards interprocedural data-flow slice starting from call arguments whose code contains the requested sink text. The default depth is 8 and the accepted range is 1-20:

```bash
npm run context:cpg:dataflow -- selectedTerritory
npm run context:cpg:dataflow -- selectedTerritory --depth 5 --method GameMap
```

By default the sink text is escaped and matched as a literal substring. Use `--regex` only when a regular-expression sink filter is intentional. `--file` and `--method` can narrow expensive slices, and `--end-at-external-method` can constrain data-flow slices to paths ending at external methods.

The query and slice layers refuse to run when the graph is `MISSING` or `STALE`. Restore or rebuild first instead of using stale structural information.

`JOERN_BIN` may point directly to the `joern` executable and `JOERN_SLICE_BIN` may point directly to `joern-slice`. `JOERN_HOME` may point to a Joern installation directory. When none are supplied, the commands reuse the pinned Joern runtime under `.context/cache/joern/` if it was bootstrapped during a CPG build.

The CI workflow provisions JDK 21, which is the runtime currently recommended by Joern. If local Joern execution fails before analysis begins, verify the local Java runtime before treating the CPG as invalid.
