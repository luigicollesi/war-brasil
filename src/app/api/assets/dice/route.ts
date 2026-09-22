import { serveAuthenticatedAssetFallback } from "@/src/lib/server/assets/asset-fallback-route";
import { assertDiceAssetKey } from "@/src/lib/server/assets/asset-storage-config";
import { isKnownDiceAssetKey } from "@/src/lib/server/assets/asset-storage-repository";
import { resolveDiceAssetReadUrl } from "@/src/lib/server/assets/asset-storage-service";

export function GET(request: Request) {
  return serveAuthenticatedAssetFallback(request, {
    assertKey: assertDiceAssetKey,
    isKnown: isKnownDiceAssetKey,
    resolveReadUrl: resolveDiceAssetReadUrl,
    unavailableMessage: "O asset cosmético está temporariamente indisponível.",
    logLabel: "asset cosmético indisponível",
  });
}
