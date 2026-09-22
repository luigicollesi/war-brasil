# Test strategy

## Goal

The test suite is split by observation boundary instead of by feature name.

- **White-box tests** may import internal modules, inspect architectural boundaries or assert internal contracts.
- **Black-box tests** exercise externally visible behavior through PostgreSQL contracts, HTTP routes and browser flows without depending on implementation details.
- The coverage target is **70% line coverage for the deterministic core**. UI adapters and persistence-heavy orchestration are validated primarily through black-box scenarios instead of being counted just to inflate a global percentage.

This split is intentionally logical first. Existing root tests remain in place to avoid a high-risk bulk move of more than two hundred files. New tests should be created under the explicit white-box/black-box structure and legacy tests can migrate incrementally.

## Current runtime flows on dev

### Authentication and commander identity

```text
Home / auth UI
  -> /api/auth/*
  -> registration verification + age command access
  -> Better Auth / PostgreSQL
  -> profile commander state
  -> /profile and protected matchmaking commands
```

### Matchmaking and lobby

```text
/matchmaking
  -> POST /api/rooms or POST /api/rooms/join
  -> authoritative room/player rows in PostgreSQL
  -> /lobby/[code]
  -> heartbeat, settings, bots and player readiness
  -> start-game server service
  -> /game/[roomId]
```

### Gameplay mutation and synchronization

```text
/game/[roomId] UI
  -> /api/games/[roomId]/* command route
  -> src/lib/server command/service boundary
  -> PostgreSQL transaction + room revision + COMMIT
  -> realtime publication
       -> PostgreSQL/Node gateway, or
       -> Cloudflare Durable Object gateway
  -> revision/patch notification
  -> client synchronization
  -> authoritative HTTP snapshot recovery when required
```

PostgreSQL remains the authority. Realtime improves delivery latency but does not define gameplay outcomes.

### Durable automation

```text
PostgreSQL automation_due_at / automation_kind
  -> worker
  -> internal automation route / authoritative command
  -> transaction + revision
  -> realtime invalidation
  -> clients recover from authoritative snapshot
```

### Economy and cosmetics

```text
/profile/store and showcase
  -> /api/economy/storefront
  -> purchase/loadout routes
  -> economy + inventory persistence
  -> profile/game cosmetic snapshot
  -> presentation in lobby/game
```

### Profile, social and notifications

```text
/profile/*
  -> profile/friends/blocks/invitations/notifications APIs
  -> PostgreSQL profile/social state
  -> user realtime ticket + notification channel
  -> UI refresh
```

## Suite boundaries

### White box

Commands:

```bash
npm run test:whitebox
npm run test:whitebox:coverage
npm run test:whitebox:coverage:70
npm run realtime:test
```

White-box scope includes:

- deterministic game rules;
- bot decision logic;
- event selection/resolution;
- map, dice and synchronization helpers;
- server/service contracts where direct internal inspection is intentional;
- worker and realtime protocol internals.

The coverage loader imports every compiled module under the deterministic coverage roots so an unreferenced module cannot disappear from the report merely because no test imported it.

The 70% gate currently targets compiled deterministic core modules in:

- `.test-build/shared/**`;
- `.test-build/bots/**`;
- `.test-build/events/**`;
- `.test-build/client/map/**`;
- `.test-build/client/dice/**`;
- `.test-build/client/sync/**`;
- `.test-build/client/operations/**`.

### Black box

Commands:

```bash
npm run test:blackbox:db
npm run test:blackbox:e2e
npm run test:blackbox:e2e:full
```

`test:blackbox:db` validates migrations and schema behavior against a real PostgreSQL instance.

`test:blackbox:e2e` is the push/PR smoke suite. Each scenario has a 20 second guard by default so an E2E process that hangs cannot hold CI indefinitely.

`test:blackbox:e2e:full` adds slower authentication, economy and social scenarios and is intended for deeper validation before release or after changes in those areas.

## Rules for new tests

1. Prefer observable behavior over source-text regexes when the behavior can be invoked directly.
2. Keep source-text assertions only for deliberate architectural invariants that cannot be expressed as runtime behavior cheaply.
3. A white-box regression test should target the smallest deterministic unit that reproduces the bug.
4. A black-box regression test should use a public route, browser interaction or database contract and must not read source files to decide whether it passed.
5. Every production bug should add at least one regression test at the lowest useful layer and, for critical user flows, one black-box scenario.
6. Do not increase the coverage percentage by excluding difficult deterministic modules. Improve tests or explicitly justify a scope change in this document.
7. The default line target is 70%. Raising it later is preferable to widening the metric with generated files, React wrappers or trivial reexports.

## CI rollout

The main Test workflow reports white-box core coverage on every push/PR, then runs database contracts, realtime/Redis checks, a production build and the black-box E2E smoke suite.

The main CI runs `test:whitebox:coverage:70`, so 70% line coverage is an enforced gate for the deterministic core. The first measured baseline before enabling the gate was 78.74% lines, 73.53% branches and 81.22% functions.
