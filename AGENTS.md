# AGENTS.md

## Rules

- Follow the user's request and repository conventions. Keep changes minimal and in scope.
- Inspect existing code/config before editing. Reuse the current architecture, package manager, scripts, and dependencies.
- Do not add dependencies, refactor unrelated code, or change public behavior unless required.

## Context acquisition

Use progressive context retrieval instead of broadly scanning the repository.

1. Read `docs/ai/cpg-summary.md` for the compact runtime map and architectural invariants.
2. Run `npm run context:cpg:status` before relying on graph information.
3. If the CPG is `CURRENT`, query only what the task needs with `context:cpg:symbol`, `callers`, `callees`, `impact`, `path`, `usages`, or `dataflow`.
4. Use graph results to identify the relevant source files, then inspect those files before editing.
5. Expand context iteratively. Do not load or dump the complete CPG into model context.
6. If the CPG is `STALE` or `MISSING`, do not trust graph relationships. Prefer `npm run context:cpg:restore` when an authenticated GitHub CLI is available and graph retrieval is useful; otherwise inspect source directly or rebuild the CPG only when the task justifies the cost.
7. Source code is always the source of truth. ADRs document architectural decisions; generated CPG data is derived and must never be edited manually.

## Project maintenance

- `.env.example` is the canonical public reference for project environment variables. Whenever a runtime/configuration change adds, removes, renames, or materially changes an environment variable, update `.env.example` in the same change. Keep real secrets only in ignored local/deployment environment files; never commit them.
- Database migrations `002` through `025` under `src/lib/db/migrations/` are legacy history and must not be rewritten or replayed by the managed runner.
- New database migrations start at `026` and belong under `src/lib/db/migrations/managed/`, using the `NNN-description.sql` naming convention and a required `-- Up Migration` section. A rollback section is optional; forward-only migrations are preferred when rollback would be unsafe or when the file may be executed directly in SQL editors.
- Keep `src/lib/db/schema.sql` aligned with the current clean-install schema. When an existing development database needs automatic convergence, update `scripts/prepare-dev-db.mjs`, the managed migration, and the database tests together.
- `scripts/prepare-dev-db.mjs` must remain a finite migration runner backed by `ops.pgmigrations`. It may validate that an unmanaged legacy database matches the required baseline before the first managed migration, but it must not use per-column/per-constraint heuristics to decide which managed migrations or partial migration steps to apply.
- While runtime SQL still uses legacy unqualified table names, keep the `public` compatibility views aligned with the final schema-qualified physical tables. Remove those views only together with the runtime SQL migration that makes them unnecessary.
- Environment, schema, migration, and dev-runtime documentation must describe the behavior that actually exists in the current branch; remove stale transitional instructions when the implementation changes.

## Skills

- Skills are optional. Use one only when it clearly helps the current task.
- Use the minimum number of skills needed; prefer the most specific one.
- Do not preload, read, or summarize all installed skills.
- Read only the selected skill and only the referenced resources needed.
- If normal repository tools are sufficient, do not use a skill.

## Do not start the project

Unless the user explicitly asks, never launch or keep the project running.

Do not run development/server/watch commands such as:
`npm start`, `npm run dev`, `next dev`, `next start`, `vite`, `pnpm dev`,
`yarn dev`, `bun dev`, `vercel dev`, `docker compose up`, or equivalents.

Do not start a local server or open a browser just to verify changes.

## Validation

- Before running a package script, inspect its definition first.
- Prefer finite checks: lint, typecheck, focused tests, and builds.
- Prefer targeted checks over full suites.
- Do not claim a check passed unless it was actually run.
- If verification requires starting the app or an unavailable service, leave it for manual verification.

## Safety

- Preserve the repository's package manager and avoid lockfile churn.
- Do not install/upgrade dependencies unless required.
- Do not run migrations, seeders, deploys, publishes, destructive scripts, or external-data changes unless explicitly required and authorized.
- Never expose secrets or `.env` contents.

## Completion

Report briefly:
1. what changed;
2. relevant files;
3. checks run;
4. anything not verified.

Do not start the project after finishing.
