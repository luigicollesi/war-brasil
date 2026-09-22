import "server-only";

import {
  authenticationRequiredResponse,
  getAuthenticatedSessionForRead,
} from "@/src/lib/server/auth/auth-guard";
import { readBoundAssetResponse } from "./asset-r2-binding";

type AssetFallbackOptions = Readonly<{
  assertKey: (value: string) => string;
  isKnown: (objectKey: string) => Promise<boolean>;
  resolveReadUrl: (
    objectKey: string,
    options?: Readonly<{ expiresInSeconds?: number; now?: Date }>,
  ) => string;
  unavailableMessage: string;
  logLabel: string;
}>;

function unavailableAssetResponse(message: string, status = 503) {
  return Response.json(
    {
      error: "ASSET_UNAVAILABLE",
      message,
    },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

function proxiedAssetResponse(upstream: Response) {
  const headers = new Headers({
    "Cache-Control": "private, max-age=300",
  });
  for (const name of ["content-type", "content-length", "etag"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}

export async function serveAuthenticatedAssetFallback(
  request: Request,
  options: AssetFallbackOptions,
) {
  const session = await getAuthenticatedSessionForRead(request);
  if (!session) return authenticationRequiredResponse();

  const requestedKey = new URL(request.url).searchParams.get("key")?.trim();
  if (!requestedKey) {
    return unavailableAssetResponse(options.unavailableMessage, 400);
  }

  try {
    const objectKey = options.assertKey(requestedKey);
    if (!(await options.isKnown(objectKey))) {
      return unavailableAssetResponse(options.unavailableMessage, 404);
    }

    // Production Cloudflare takes this zero-network-hop path through the R2
    // binding. S3 signing exists only as the Node/local compatibility fallback.
    const boundResponse = await readBoundAssetResponse(objectKey);
    if (boundResponse) {
      return boundResponse.status === 404
        ? unavailableAssetResponse(options.unavailableMessage, 404)
        : boundResponse;
    }

    const location = options.resolveReadUrl(objectKey, {
      expiresInSeconds: 300,
    });
    const upstream = await fetch(location, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return unavailableAssetResponse(
        options.unavailableMessage,
        upstream.status === 404 ? 404 : 503,
      );
    }

    return proxiedAssetResponse(upstream);
  } catch (error) {
    const diagnostic =
      error && typeof error === "object" && "code" in error
        ? String(
            (error as { code?: unknown }).code ?? "ASSET_DELIVERY_FAILED",
          )
        : "ASSET_DELIVERY_FAILED";
    console.warn(`[war-brasil] ${options.logLabel}`, { diagnostic });
    return unavailableAssetResponse(options.unavailableMessage);
  }
}
