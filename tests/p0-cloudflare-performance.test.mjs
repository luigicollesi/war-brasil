import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("lobby reuses game realtime transport and only watchdog-polls while connected", () => {
  const sync = read("src/hooks/use-lobby-sync.ts");
  const publisher = read(
    "src/lib/server/realtime/lobby-realtime-publisher.ts",
  );
  const runtime = read(
    "src/lib/server/realtime/game-realtime-bus-runtime.ts",
  );
  const route = read("src/app/api/rooms/[code]/route.ts");

  assert.match(sync, /createGameRealtimeTransport/);
  assert.match(sync, /REALTIME_WATCHDOG_INTERVAL_MS = 30_000/);
  assert.match(sync, /FALLBACK_POLLING_INTERVAL_MS = 2_000/);
  assert.match(sync, /event\.type !== "game\.invalidate"/);
  assert.match(sync, /GAME_REVISION_HEADER/);
  assert.match(route, /GAME_REVISION_HEADER/);
  assert.match(publisher, /SET revision=revision\+1/);
  assert.match(publisher, /scope: "room"/);
  assert.match(runtime, /publishCommittedGameRealtimeBusEvent/);
});

test("all lobby mutation entrypoints emit post-commit invalidation", () => {
  const routes = [
    "src/app/api/rooms/join/route.ts",
    "src/app/api/rooms/[code]/me/route.ts",
    "src/app/api/rooms/[code]/settings/route.ts",
    "src/app/api/rooms/[code]/bots/route.ts",
    "src/app/api/rooms/[code]/bots/[botId]/route.ts",
    "src/app/api/profile/game-invitations/[invitationId]/accept/route.ts",
  ];
  for (const path of routes) {
    assert.match(read(path), /publishLobbyChangeByCode/);
  }
});

test("OpenNext Worker binds R2 directly and delivery can bypass Next via custom domain", () => {
  const wrangler = read("wrangler.jsonc");
  const storage = read("src/lib/server/assets/asset-storage-service.ts");
  const collection = read("src/lib/server/assets/collection-asset-storage.ts");
  const appearance = read(
    "src/lib/server/profile/profile-appearance-asset-storage.ts",
  );
  const binding = read("src/lib/server/assets/asset-r2-binding.ts");
  const env = read(".env.example");

  assert.match(wrangler, /"binding": "ASSET_STORAGE"/);
  assert.match(wrangler, /"bucket_name": "war-brasil-assets-prod"/);
  assert.match(storage, /publicAssetDeliveryUrl/);
  assert.match(collection, /publicAssetDeliveryUrl/);
  assert.match(appearance, /publicAssetDeliveryUrl/);
  assert.match(binding, /getCloudflareContext/);
  assert.match(binding, /env\.ASSET_STORAGE/);
  assert.match(binding, /bucket\.get\(objectKey\)/);
  assert.match(env, /ASSET_PUBLIC_BASE_URL=https:\/\/assets\.bellumcivile\.com/);
});

test("asset API fallbacks prefer R2 binding before signed S3 fetches", () => {
  for (const path of [
    "src/app/api/assets/dice/route.ts",
    "src/app/api/assets/territory-skins/route.ts",
    "src/app/api/assets/collections/route.ts",
    "src/app/api/assets/profile-appearance/route.ts",
  ]) {
    const route = read(path);
    assert.match(route, /readBoundAssetResponse/);
    assert.match(route, /const boundResponse = await readBoundAssetResponse/);
  }
});
