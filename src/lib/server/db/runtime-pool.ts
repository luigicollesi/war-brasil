import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Pool, type PoolConfig } from "pg";

type RuntimePoolOptions = Readonly<{
  label: string;
  persistentPool: Pool;
  workerConfig: () => PoolConfig;
  hyperdriveBinding?: string;
}>;

type CloudflareRequestContext = Readonly<{
  ctx: object;
  env: Record<string, unknown>;
}>;

const WORKER_CONNECTION_TIMEOUT_MS = 8_000;
const WORKER_IDLE_TIMEOUT_MS = 1_000;
const WORKER_MAX_CONNECTIONS = 5;

function workerMaxConnections(configured: number | undefined) {
  if (!configured || !Number.isFinite(configured)) return 4;
  return Math.max(1, Math.min(WORKER_MAX_CONNECTIONS, Math.floor(configured)));
}

function cloudflareRequestContext(): CloudflareRequestContext | null {
  try {
    const context = getCloudflareContext();
    const ctx = context.ctx;

    if (
      (typeof ctx !== "object" || ctx === null) &&
      typeof ctx !== "function"
    ) {
      return null;
    }

    return {
      ctx: ctx as object,
      env: context.env as unknown as Record<string, unknown>,
    };
  } catch {
    // next dev and non-Cloudflare Node runtimes do not have an OpenNext
    // request context. They intentionally keep using the persistent Pool.
    return null;
  }
}

function hyperdriveConnectionString(
  env: Record<string, unknown>,
  bindingName: string | undefined,
) {
  if (!bindingName) return null;

  const binding = env[bindingName];
  if (!binding || typeof binding !== "object") return null;

  const connectionString = (binding as { connectionString?: unknown })
    .connectionString;
  return typeof connectionString === "string" && connectionString.trim()
    ? connectionString
    : null;
}

function createWorkerRequestPool(
  options: RuntimePoolOptions,
  env: Record<string, unknown>,
) {
  const configured = options.workerConfig();
  const hyperdrive = hyperdriveConnectionString(
    env,
    options.hyperdriveBinding,
  );

  const pool = new Pool({
    ...configured,
    ...(hyperdrive ? { connectionString: hyperdrive } : {}),
    max: workerMaxConnections(configured.max),
    connectionTimeoutMillis:
      configured.connectionTimeoutMillis ?? WORKER_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis:
      configured.idleTimeoutMillis ?? WORKER_IDLE_TIMEOUT_MS,
    // OpenNext/Cloudflare must never reuse the same PostgreSQL connection in
    // another Worker request. A checked-out transaction can still issue many
    // queries before release(); maxUses applies when the client returns.
    maxUses: 1,
  } as PoolConfig);

  pool.on("error", (error) => {
    console.error(`[war-brasil] ${options.label} request pool error`, {
      name: error.name,
      message: error.message,
    });
  });

  return pool;
}

/**
 * Preserves the pg.Pool API expected by the application while selecting the
 * correct lifecycle for the current runtime:
 *
 * - Node/next dev: one persistent Pool, matching the existing behavior.
 * - Cloudflare/OpenNext: one Pool per ExecutionContext with maxUses=1.
 *
 * The facade itself is safe to export globally because it owns no Worker I/O.
 * Every method resolves the active request pool when it is invoked, even if a
 * consumer (for example Better Auth/Kysely) captured the method earlier.
 */
export function createRuntimePool(options: RuntimePoolOptions): Pool {
  const requestPools = new WeakMap<object, Pool>();
  const methodWrappers = new Map<PropertyKey, (...args: unknown[]) => unknown>();

  function activePool() {
    const context = cloudflareRequestContext();
    if (!context) return options.persistentPool;

    const existing = requestPools.get(context.ctx);
    if (existing) return existing;

    const created = createWorkerRequestPool(options, context.env);
    requestPools.set(context.ctx, created);
    return created;
  }

  return new Proxy(options.persistentPool, {
    get(target, property) {
      if (
        property === "totalCount" ||
        property === "idleCount" ||
        property === "waitingCount"
      ) {
        const selected = activePool();
        return Reflect.get(selected, property, selected);
      }

      const targetValue = Reflect.get(target, property, target);
      if (typeof targetValue !== "function") {
        return targetValue;
      }

      const cached = methodWrappers.get(property);
      if (cached) return cached;

      const wrapper = (...args: unknown[]) => {
        const selected = activePool();
        const method = Reflect.get(selected, property, selected);

        if (typeof method !== "function") {
          throw new TypeError(
            `Pool method ${String(property)} is unavailable in the active runtime.`,
          );
        }

        return Reflect.apply(method, selected, args);
      };

      methodWrappers.set(property, wrapper);
      return wrapper;
    },
  }) as Pool;
}
