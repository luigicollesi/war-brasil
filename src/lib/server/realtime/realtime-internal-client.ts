import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

type RealtimeServiceBinding = {
  fetch(input: Request): Promise<Response>;
};

function realtimeServiceBinding(): RealtimeServiceBinding | null {
  try {
    const env = getCloudflareContext().env as unknown as Record<string, unknown>;
    const binding = env.GAME_REALTIME_SERVICE;
    if (
      binding &&
      typeof binding === "object" &&
      typeof (binding as { fetch?: unknown }).fetch === "function"
    ) {
      return binding as RealtimeServiceBinding;
    }
  } catch {
    // Node/local development intentionally falls back to the configured URL.
  }
  return null;
}

function realtimeInternalUrl() {
  const value = process.env.GAME_REALTIME_INTERNAL_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

function realtimeInternalToken() {
  return process.env.GAME_REALTIME_INTERNAL_TOKEN?.trim() || null;
}

export function realtimeInternalConfigured() {
  return Boolean(
    realtimeInternalToken() &&
      (realtimeServiceBinding() || realtimeInternalUrl()),
  );
}

export async function realtimeInternalFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  if (!path.startsWith("/")) {
    throw new Error("Caminho interno realtime inválido.");
  }

  const token = realtimeInternalToken();
  if (!token) return null;

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const service = realtimeServiceBinding();
  if (service) {
    return service.fetch(
      new Request(`https://realtime.internal${path}`, {
        ...init,
        headers,
      }),
    );
  }

  const baseUrl = realtimeInternalUrl();
  if (!baseUrl) return null;

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });
}
