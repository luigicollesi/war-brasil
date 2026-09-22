import { serveAuthenticatedAssetFallback } from "@/src/lib/server/assets/asset-fallback-route";
import { assertTerritorySkinAssetKey } from "@/src/lib/server/assets/asset-storage-config";
import { isKnownTerritorySkinAssetKey } from "@/src/lib/server/assets/asset-storage-repository";
import { resolveTerritorySkinAssetReadUrl } from "@/src/lib/server/assets/asset-storage-service";

export function GET(request: Request) {
  return serveAuthenticatedAssetFallback(request, {
    assertKey: assertTerritorySkinAssetKey,
    isKnown: isKnownTerritorySkinAssetKey,
    resolveReadUrl: resolveTerritorySkinAssetReadUrl,
    unavailableMessage: "A skin territorial está temporariamente indisponível.",
    logLabel: "skin territorial indisponível",
  });
}
