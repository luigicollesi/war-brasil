# Phase 4 runtime

## Safe defaults

The Phase 4 runtime keeps the previous behavior unless explicitly enabled:

```text
GAME_REALTIME_EVENT_SOURCE=postgres
GAME_REALTIME_AUTH_MODE=cookie
```

Redis and ticket authentication are opt-in.

## Realtime gateway

Required base environment:

```text
GAME_REALTIME_ENABLED=true
DATABASE_URL=postgresql://...
GAME_REALTIME_ALLOWED_ORIGINS=https://example.com
```

Optional:

```text
GAME_REALTIME_PORT=3001
GAME_REALTIME_EVENT_SOURCE=postgres|dual|redis
GAME_REALTIME_REDIS_URL=redis://...
GAME_REALTIME_AUTH_MODE=cookie|ticket|either
GAME_REALTIME_TICKET_SECRET=<at least 32 characters>
```

Event source modes:

- `postgres`: PostgreSQL `LISTEN/NOTIFY` is the primary source. Redis is not required.
- `dual`: PostgreSQL remains the primary source that drives sockets. Redis subscribes to the same locally active rooms only for shadow delivery metrics. Redis failure in this mode does not make the gateway unready.
- `redis`: Redis Pub/Sub is the primary realtime source. Redis health is therefore part of gateway readiness.

When Redis participates (`dual` or `redis`), the gateway subscribes to `war:game:<roomId>:v1` only while one or more local sockets belong to that room. The room subscription is acquired before the connection is confirmed with `realtime.ready`.

Health endpoints:

```text
GET /health/live
GET /health/ready
GET /health
```

`/health/ready` must be used for traffic admission. A draining gateway stops accepting new upgrades before closing existing sockets. In `dual`, the health payload also exposes Redis shadow health without using it as a readiness gate.

## Redis relay rollout

The current Redis rollout keeps PostgreSQL publication intact and uses a separate relay:

```text
Next/API
  -> PostgreSQL COMMIT
  -> pg_notify
  -> realtime Redis relay
  -> Redis Pub/Sub room channel
  -> N realtime gateways
```

Run the relay with:

```text
DATABASE_URL=postgresql://...
GAME_REALTIME_REDIS_URL=redis://...
npm --prefix realtime run relay
```

Only one relay instance is operationally necessary during this transitional rollout. Duplicate relays would produce duplicate ephemeral events, which revision handling makes safe but wasteful.

Recommended rollout order:

1. Keep gateways on `postgres` and start the Redis relay.
2. Move a subset of gateways to `dual` and compare Redis shadow delivery against PostgreSQL primary delivery.
3. If shadow health and delivery metrics are acceptable, move gateways gradually to `redis`.
4. On Redis or relay degradation, move gateways back to `postgres`; authoritative HTTP commands and snapshots remain valid throughout.

If a gateway is already in `redis` mode and Redis becomes unavailable, clients naturally degrade to HTTP polling when sockets close or cannot reconnect. PostgreSQL remains the authoritative game state in every mode.

## Realtime tickets

Server and gateway must share:

```text
GAME_REALTIME_TICKET_SECRET=<same strong secret>
```

Optional server TTL:

```text
GAME_REALTIME_TICKET_TTL_SECONDS=45
```

Allowed range is 15–120 seconds. The browser can opt into ticket authentication with:

```text
NEXT_PUBLIC_GAME_REALTIME_AUTH_MODE=ticket
```

The client obtains a new ticket from:

```text
POST /api/games/:roomId/realtime-ticket
```

before every initial connection or reconnect. The long-lived player cookie is not placed in the ticket.

## Automation workers

Existing worker environment remains valid. Multi-instance controls add:

```text
GAME_AUTOMATION_WORKER_CONCURRENCY=4
GAME_AUTOMATION_WORKER_LEASE_MS=10000
GAME_AUTOMATION_WORKER_INSTANCE_ID=<optional stable instance name>
```

Active workers claim due rooms with an expiring PostgreSQL lease. A successful or stale/no-op execution releases the claim. A failed execution keeps the lease until expiration so another instance can recover it without a hot retry loop.

`expectedRevision` is still mandatory for internal automation execution. The lease is a work-distribution optimization, not a replacement for revision fencing.

## Ephemeral transport

`GameEphemeralTransport` is currently backed only by `NullGameEphemeralTransport`. No gameplay correctness may depend on this boundary. A future WebTransport implementation is allowed only for discardable cosmetic traffic.
