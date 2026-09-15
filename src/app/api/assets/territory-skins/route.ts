import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { assertTerritorySkinAssetKey } from "@/src/lib/server/assets/asset-storage-config";
import { isKnownTerritorySkinAssetKey } from "@/src/lib/server/assets/asset-storage-repository";
import { resolveTerritorySkinAssetReadUrl } from "@/src/lib/server/assets/asset-storage-service";

function unavailableAssetResponse(status = 503) {
  return Response.json(
    {
      error: "ASSET_UNAVAILABLE",
      message: "A skin territorial está temporariamente indisponível.",
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
    const objectKey = assertTerritorySkinAssetKey(requestedKey);
    if (!(await isKnownTerritorySkinAssetKey(objectKey))) {
      return unavailableAssetResponse(404);
    }

    const location = resolveTerritorySkinAssetReadUrl(objectKey, {
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
    console.warn("[war-brasil] skin territorial indisponível", { diagnostic });
    return unavailableAssetResponse();
  }
}
