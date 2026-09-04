# Realtime Phase 2 runtime

The Phase 2 gateway remains a process separate from Next.js. In production it is disabled unless `GAME_REALTIME_ENABLED=true`.

## Local installation

```bash
npm ci
```

The normal development command now prepares the database and starts both the Next.js process and the realtime gateway:

```bash
npm run dev
```

When the variables are not explicitly configured, development uses these defaults:

```text
GAME_REALTIME_ENABLED=true
GAME_REALTIME_PORT=3001
NEXT_PUBLIC_GAME_REALTIME_MODE=hybrid
NEXT_PUBLIC_GAME_REALTIME_URL=ws://localhost:3001/realtime
GAME_REALTIME_EVENT_SOURCE=postgres
```

`npm run dev` installs the nested realtime dependencies with `npm --prefix realtime ci` only when they are missing. Explicit environment values continue to take precedence. Setting `GAME_REALTIME_ENABLED=false` intentionally starts only Next.js and leaves ephemeral mechanics such as trade possession signals unavailable.

## Gateway

Required outside the development orchestrator:

```text
DATABASE_URL
GAME_REALTIME_ENABLED=true
```

Development defaults supported by the gateway:

```text
GAME_REALTIME_PORT=3001
GAME_REALTIME_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
GAME_REALTIME_CHANNEL=war_game_revision
```

The gateway can still be started independently for infrastructure work:

```bash
npm run realtime:install
npm run realtime:start
```

## Client rollout

Production/default rollout remains opt-in through:

```text
NEXT_PUBLIC_GAME_REALTIME_MODE=off
```

Shadow validation:

```text
NEXT_PUBLIC_GAME_REALTIME_MODE=shadow
NEXT_PUBLIC_GAME_REALTIME_URL=ws://localhost:3001/realtime
```

Hybrid validation:

```text
NEXT_PUBLIC_GAME_REALTIME_MODE=hybrid
NEXT_PUBLIC_GAME_REALTIME_URL=ws://localhost:3001/realtime
```

`shadow` keeps the existing polling behavior. `hybrid` wakes HTTP synchronization from revision events and changes idle polling to a 30 s visible / 60 s hidden watchdog only while realtime is connected. Automatic advances keep the previous polling cadence.

## Production topology

The browser cookie is host-scoped and HTTP-only, so the public WebSocket endpoint should be exposed under the same site hostname (normally through a reverse proxy for `/realtime`). `GAME_REALTIME_ALLOWED_ORIGINS` must explicitly list the production web origin.

The gateway is disposable. Its in-memory registry contains sockets only. Game state remains in PostgreSQL.
