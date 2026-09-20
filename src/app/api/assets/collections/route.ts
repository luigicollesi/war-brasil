import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import {
  assertCollectionAssetKey,
  resolveCollectionAssetReadUrl,
} from "@/src/lib/server/assets/collection-asset-storage";
import { isKnownCollectionAssetKey } from "@/src/lib/server/assets/asset-storage-repository";

function unavailableAssetResponse(status = 503) {
  return Response.json(
    {
      error: "ASSET_UNAVAILABLE",
      message: "O asset editorial está temporariamente indisponível.",
    },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function GET(request: Request) {
  const session = await getAuthenticatedSession(request);
  if (!session) return authenticationRequiredResponse();

  const requestedKey = new URL(request.url).searchParams.get("key")?.trim();
  if (!requestedKey) return unavailableAssetResponse(400);

  try {
    const objectKey = assertCollectionAssetKey(requestedKey);
    if (!(await isKnownCollectionAssetKey(objectKey))) {
      return unavailableAssetResponse(404);
    }

    const location = resolveCollectionAssetReadUrl(objectKey, {
      expiresInSeconds: 300,
    });
    return new Response(null, {
      status: 307,
      headers: {
        Location: location,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const diagnostic =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "ASSET_DELIVERY_FAILED")
        : "ASSET_DELIVERY_FAILED";
    console.warn("[war-brasil] asset editorial de coleção indisponível", {
      diagnostic,
    });
    return unavailableAssetResponse();
  }
}
