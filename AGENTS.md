# AGENTS.md

## Rules

- Follow the user's request and repository conventions. Keep changes minimal and in scope.
- Inspect existing code/config before editing. Reuse the current architecture, package manager, scripts, and dependencies.
- Do not add dependencies, refactor unrelated code, or change public behavior unless required.

## Project maintenance

- `.env.example` is the canonical public reference for project environment variables. Whenever a runtime/configuration change adds, removes, renames, or materially changes an environment variable, update `.env.example` in the same change. Keep real secrets only in ignored local/deployment environment files; never commit them.
- For database schema changes, prefer a new numbered migration under `src/lib/db/migrations/` instead of rewriting a migration that may already have been applied.
- Keep `src/lib/db/schema.sql` aligned with the final schema for clean installations. When an existing development database needs automatic convergence, update `scripts/prepare-dev-db.mjs` and its tests together with the migration.
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
