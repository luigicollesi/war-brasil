# HOME — Remaining Implementation Plan

Status source: `feature/pre-game-home` after HEAD `bf245897`, with PR #38 still draft.

## 1. Current state

Already implemented in the Home track:

- semantic `/` route with preserved metadata/JSON-LD;
- `ENTRAR NO COMANDO` immediately usable;
- non-blocking `earth -> brazil -> table -> stable` ceremony;
- skip, repeat-visit and `prefers-reduced-motion` behavior;
- accessible DOM destinations for `/matchmaking`, `/rules`, `/profile`;
- keyboard/pointer focus separation;
- mobile/touch hardening and safe-area handling;
- local 42-territory fallback;
- HOME-focused structural tests;
- lint/test/migrations/realtime/build green on the current branch.

The local visual scene remains provisional. It must not be considered the final Foundation implementation.

## 2. External dependency now available

PR #39 / `feature/pre-game-foundation` publishes the real public contract:

- `CommandShell`;
- `CommandSceneIntent`;
- semantic scene modes (`entrance`, `operations`, `lobby`, `doctrine`, `profile`);
- semantic focus (`earth`, `brazil`, `table`, `insignia`, `none`);
- `conflictLevel`, `territoryExplode`, `orbitalAlignment`;
- canonical 42-territory 2.5D renderer;
- fallback/WebGL failure handling;
- compact scene/mobile behavior;
- reduced-motion/on-demand rendering.

The Home must consume this public API only. It must not import `CommandScene`, Canvas, CameraDirector, Three objects, scene presets or internal geometry.

## 3. Remaining work map

### R1 — Integrate Foundation into the Home branch

Blocked until PR #39 is integrated into `dev` (preferred by `parallel-development.md`).

After Foundation reaches `dev`:

1. sync `feature/pre-game-home` with the new `dev`;
2. resolve conflicts without changing Foundation internals;
3. import only from `src/components/pre-game/foundation` public barrel;
4. rerun the full CI before changing Home behavior.

### R2 — Replace provisional scene with `CommandShell`

The current Home-owned globe/table/crown/map fallback must be removed after Foundation integration.

Expected cleanup:

- delete `command-home-fallback.tsx`;
- remove Home-owned globe, Crown, Domain Table and Brazil rendering CSS;
- remove local Foundation-like color/material duplication where the shared tokens already cover it;
- keep only Home layout, typography, authorization CTA, destination rail and Home-specific responsive rules;
- keep `src/app/page.tsx` as the SEO/server boundary.

Goal: exactly one scene implementation and one canonical fallback path.

### R3 — Add a pure Home -> Foundation intent adapter

Create `command-home-scene-intent.ts` with a pure function that receives Home UI state and returns `CommandSceneIntent`.

Proposed mapping:

| Home state | Foundation intent |
| --- | --- |
| ceremony `earth` | `{ mode: "entrance", focus: "earth", conflictLevel: 0, territoryExplode: 0, orbitalAlignment: 0 }` |
| ceremony `brazil` | `{ mode: "entrance", focus: "brazil", conflictLevel: 0, territoryExplode: 0, orbitalAlignment: 0 }` |
| ceremony `table` / stable before entry | `{ mode: "entrance", focus: "table", conflictLevel: 0, territoryExplode: 0, orbitalAlignment: 0 }` |
| command open, no destination focus | `{ mode: "entrance", focus: "table", conflictLevel: 0, territoryExplode: 0, orbitalAlignment: 1 }` |
| Operations focus | `{ mode: "operations", focus: "brazil", conflictLevel: 1, territoryExplode: 0.08, orbitalAlignment: 1 }` |
| Doctrine focus | `{ mode: "doctrine", focus: "brazil", conflictLevel: 0, territoryExplode: 0.12, orbitalAlignment: 0 }` |
| Profile focus | `{ mode: "profile", focus: "insignia", conflictLevel: 0, territoryExplode: 0, orbitalAlignment: 1 }` |

`transitioning` uses the destination intent but MUST NOT delay the actual Next.js navigation.

The mapper must have unit/structural tests and must remain independent of XYZ/FOV/material/viewport values.

### R4 — Restructure the client boundary

`CommandHomeClient` should own only Home interaction state plus the semantic scene intent.

Recommended shape:

- `page.tsx`: metadata, JSON-LD and `<CommandHomeExperience />` entry;
- `command-home-client.tsx`: ceremony/session/reduced-motion/destination state;
- `command-home-scene-intent.ts`: pure state -> `CommandSceneIntent` mapping;
- `CommandShell`: shared scene host and shared visual infrastructure;
- Home DOM content rendered as children/overlay of the shell.

Do not create a second scene context/store.

Foundation already lazy-loads the WebGL Client Component; keep that behavior instead of adding another dynamic renderer in Home.

### R5 — Reconcile reduced motion and repeat visit with Foundation

Home controls whether the ceremony advances through `earth/brazil/table`; Foundation controls how each intent is physically rendered.

Rules:

- reduced motion starts Home at semantic `stable/table` state;
- repeat visit starts at semantic `stable/table` state;
- no Home timer is required in either case;
- Foundation's reduced-motion rendering remains authoritative for camera/orbits/frame loop;
- Home must not duplicate Foundation media-query logic for renderer behavior.

### R6 — Complete HOME-09 and visual CORE coverage

After Foundation integration, verify:

- the Brazil assembly is the canonical 42-territory model;
- the 42 territories read as a united Brazil at rest;
- Crown is present but subordinate before authorization;
- globe recedes after the opening ritual;
- Operations raises conflict/red without becoming permanent;
- Doctrine reads analytical rather than conflict-heavy;
- Profile directs attention to the insignia/prestige zone;
- `awaiting-entry -> command-open -> destination-focus` remains the same physical installation.

This closes the currently missing HOME-09 plus HOME-V1..V4 evidence.

### R7 — Deterministic browser evidence

Preferred implementation: introduce Playwright only if the repository agrees to shared E2E infrastructure. Do not add a Home-only ad-hoc browser harness.

Required Home scenarios:

- desktop 1440x900;
- mobile 390x844;
- awaiting-entry;
- command-open;
- operations-focus;
- doctrine-focus;
- profile-focus;
- repeat-visit;
- reduced-motion;
- fallback/WebGL unavailable.

For visual snapshots:

- disable/freeze animations;
- use the same OS/browser environment for baseline and CI;
- avoid timers/randomness in screenshot state;
- assert URLs separately from screenshots;
- assert no horizontal overflow at 390x844;
- assert keyboard focus visibility and touch-sized targets.

If shared Playwright infrastructure is not accepted yet, record the same scenarios manually with reproducible viewport/state instructions in PR #38.

### R8 — End-to-end navigation after consumer routes integrate

HOME-01 can be fully validated now because `/matchmaking` already exists.

HOME-02 and HOME-03 should be rerun after Doctrine `/rules` and Profile `/profile` are integrated into `dev`.

The Home branch must not copy those page implementations merely to make its E2E green.

### R9 — Remove provisional tests and strengthen final contract tests

Update `tests/pre-game-home.test.mjs` after Foundation integration:

- assert Home imports `CommandShell` and `CommandSceneIntent` only through the public barrel;
- assert no `@react-three/fiber`, `three`, Canvas, CameraDirector or internal Foundation path is imported by Home;
- assert local fallback scene component no longer exists;
- assert scene intent mapper covers every Home ceremony/focus state;
- retain metadata, DOM routes, session, reduced-motion, keyboard and mobile contract tests;
- retain the canonical 42-territory assertion at Foundation level instead of duplicating renderer responsibility in Home.

### R10 — Final merge gate

Before marking PR #38 ready:

1. Foundation must already be in `dev`;
2. sync Home with latest `dev`;
3. run `npm run lint`;
4. run `npm test`;
5. run migration tests;
6. run `npm run realtime:test`;
7. run `npm run build`;
8. collect desktop/mobile evidence;
9. fill HOME-01..HOME-12 matrix with evidence links;
10. score HOME >= 85/100;
11. confirm every applicable CORE concept in `traceability.md`;
12. keep PR draft if any BLOCKER lacks evidence.

## 4. Recommended execution order

Critical path:

`Foundation PR #39 -> integrate Foundation into dev -> sync Home -> replace provisional scene -> intent adapter -> visual polish -> browser evidence -> consumer-route E2E -> final CI/EVAL -> PR ready`.

Do not merge Home before Foundation. Do not merge the provisional CSS scene as the final renderer.

## 5. Technical references

- Next.js 16.3.4: Server/Client boundaries and lazy loading of Client Components.
- Foundation PR #39: `CommandShell` and declarative `CommandSceneIntent` are the only Home-facing scene API.
- React Three Fiber: on-demand rendering and resource reuse remain owned by Foundation.
- Playwright: `toHaveScreenshot()` should use deterministic animation state and consistent baseline/CI environment.
