import { serveAuthenticatedAssetFallback } from "@/src/lib/server/assets/asset-fallback-route";
import { isKnownProfileAppearanceAssetKey } from "@/src/lib/server/profile/profile-appearance-repository";
import {
  assertProfileAppearanceAssetKey,
  resolveProfileAppearanceAssetReadUrl,
} from "@/src/lib/server/profile/profile-appearance-asset-storage";

export function GET(request: Request) {
  return serveAuthenticatedAssetFallback(request, {
    assertKey: assertProfileAppearanceAssetKey,
    isKnown: isKnownProfileAppearanceAssetKey,
    resolveReadUrl: resolveProfileAppearanceAssetReadUrl,
    unavailableMessage: "O asset de aparência está temporariamente indisponível.",
    logLabel: "asset de aparência indisponível",
  });
}
