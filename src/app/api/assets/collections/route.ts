import { serveAuthenticatedAssetFallback } from "@/src/lib/server/assets/asset-fallback-route";
import { isKnownCollectionAssetKey } from "@/src/lib/server/assets/asset-storage-repository";
import {
  assertCollectionAssetKey,
  resolveCollectionAssetReadUrl,
} from "@/src/lib/server/assets/collection-asset-storage";

export function GET(request: Request) {
  return serveAuthenticatedAssetFallback(request, {
    assertKey: assertCollectionAssetKey,
    isKnown: isKnownCollectionAssetKey,
    resolveReadUrl: resolveCollectionAssetReadUrl,
    unavailableMessage: "O asset editorial está temporariamente indisponível.",
    logLabel: "asset editorial de coleção indisponível",
  });
}
