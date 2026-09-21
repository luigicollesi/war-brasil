import "server-only";

import type { CommanderPresence } from "@/src/lib/profile/profile-command-contract";

const MAX_BATCH_SIZE = 100;
const INTERNAL_TIMEOUT_MS = 1_500;
const MIN_INTERNAL_TIMEOUT_MS = 100;
const MAX_INTERNAL_TIMEOUT_MS = 5_000;

type PresenceRequestOptions = Readonly<{
  timeoutMs?: number;
}>;

function boundedTimeout(value: number | undefined) {
  if (!value || !Number.isFinite(value)) return INTERNAL_TIMEOUT_MS;
  return Math.max(
    MIN_INTERNAL_TIMEOUT_MS,
    Math.min(MAX_INTERNAL_TIMEOUT_MS, Math.trunc(value)),
  );
}

type PresenceBatchResult = Readonly<{
  availability: "available" | "unavailable";
  presences: ReadonlyMap<string, CommanderPresence>;
}>;

export type OwnPresenceHeartbeat = CommanderPresence &
  Readonly<{
    shouldPersistLastSeen: boolean;
  }>;

function internalConfig() {
  const rawUrl = process.env.GAME_REALTIME_INTERNAL_URL?.trim();
  const token = process.env.GAME_REALTIME_INTERNAL_TOKEN?.trim();
  if (!rawUrl || !token) return null;
  return {
    baseUrl: rawUrl.replace(/\/$/, ""),
    token,
  };
}

async function postInternal(
  path: string,
  body: unknown,
  options: PresenceRequestOptions = {},
) {
  const config = internalConfig();
  if (!config) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    boundedTimeout(options.timeoutMs),
  );
  timeout.unref?.();

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== "object") return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function renewOwnPresence(
  userId: string,
  options: PresenceRequestOptions = {},
): Promise<OwnPresenceHeartbeat> {
  const payload = await postInternal(
    "/internal/presence/heartbeat",
    { userId },
    options,
  );
  if (
    payload?.availability !== "available" ||
    payload.state !== "online"
  ) {
    return {
      state: "unavailable",
      lastSeenAt: null,
      shouldPersistLastSeen: false,
    };
  }

  return {
    state: "online",
    lastSeenAt:
      typeof payload.observedAt === "string" ? payload.observedAt : null,
    shouldPersistLastSeen: payload.persistLastSeen === true,
  };
}

export async function getPresenceStates(
  userIds: ReadonlyArray<string>,
): Promise<PresenceBatchResult> {
  const unique = [...new Set(userIds)].slice(0, MAX_BATCH_SIZE);
  if (unique.length === 0) {
    return { availability: "available", presences: new Map() };
  }

  const payload = await postInternal("/internal/presence/batch", {
    userIds: unique,
  });
  if (payload?.availability !== "available" || !Array.isArray(payload.presences)) {
    return { availability: "unavailable", presences: new Map() };
  }

  const states = new Map<string, CommanderPresence>();
  for (const entry of payload.presences) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Record<string, unknown>;
    if (
      typeof value.userId !== "string" ||
      (value.state !== "online" && value.state !== "offline")
    ) {
      continue;
    }
    states.set(value.userId, {
      state: value.state,
      lastSeenAt: typeof value.lastSeenAt === "string" ? value.lastSeenAt : null,
    });
  }

  if (states.size !== unique.length) {
    return { availability: "unavailable", presences: new Map() };
  }
  return { availability: "available", presences: states };
}
