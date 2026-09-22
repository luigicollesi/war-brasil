import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { readBoundAssetResponse } from "@/src/lib/server/assets/asset-r2-binding";
import { assertDiceAssetKey } from "@/src/lib/server/assets/asset-storage-config";
import { isKnownDiceAssetKey } from "@/src/lib/server/assets/asset-storage-repository";
import { resolveDiceAssetReadUrl } from "@/src/lib/server/assets/asset-storage-service";

function unavailableAssetResponse(status = 503) {
  return Response.json(
    {
      error: "ASSET_UNAVAILABLE",
      message: "O asset cosmético está temporariamente indisponível.",
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
  const contentType = upstream.headers.get("content-type");
  const contentLength = upstream.headers.get("content-length");
  if (contentType) headers.set("Content-Type", contentType);
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}

export async function GET(request: Request) {
  const session = await getAuthenticatedSession(request);
  if (!session) return authenticationRequiredResponse();

  const requestedKey = new URL(request.url).searchParams.get("key")?.trim();
  if (!requestedKey) return unavailableAssetResponse(400);

  try {
    const objectKey = assertDiceAssetKey(requestedKey);
    if (!(await isKnownDiceAssetKey(objectKey))) {
      return unavailableAssetResponse(404);
    }

    const boundResponse = await readBoundAssetResponse(objectKey);
    if (boundResponse) {
      return boundResponse.status === 404
        ? unavailableAssetResponse(404)
        : boundResponse;
    }

    const location = resolveDiceAssetReadUrl(objectKey, { expiresInSeconds: 300 });
    const upstream = await fetch(location, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return unavailableAssetResponse(upstream.status === 404 ? 404 : 503);
    }

    return proxiedAssetResponse(upstream);
  } catch (error) {
    const diagnostic =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "ASSET_DELIVERY_FAILED")
        : "ASSET_DELIVERY_FAILED";
    console.warn("[war-brasil] asset cosmético indisponível", { diagnostic });
    return unavailableAssetResponse();
  }
}
