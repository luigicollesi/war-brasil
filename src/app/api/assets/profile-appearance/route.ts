import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { readBoundAssetResponse } from "@/src/lib/server/assets/asset-r2-binding";
import {
  assertProfileAppearanceAssetKey,
  resolveProfileAppearanceAssetReadUrl,
} from "@/src/lib/server/profile/profile-appearance-asset-storage";
import { isKnownProfileAppearanceAssetKey } from "@/src/lib/server/profile/profile-appearance-repository";

function unavailableAssetResponse(status = 503) {
  return Response.json(
    {
      error: "ASSET_UNAVAILABLE",
      message: "O asset de aparência está temporariamente indisponível.",
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
    const objectKey = assertProfileAppearanceAssetKey(requestedKey);
    if (!(await isKnownProfileAppearanceAssetKey(objectKey))) {
      return unavailableAssetResponse(404);
    }

    const boundResponse = await readBoundAssetResponse(objectKey);
    if (boundResponse) {
      return boundResponse.status === 404
        ? unavailableAssetResponse(404)
        : boundResponse;
    }

    const location = resolveProfileAppearanceAssetReadUrl(objectKey, {
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
    console.warn("[war-brasil] asset de aparência indisponível", { diagnostic });
    return unavailableAssetResponse();
  }
}
