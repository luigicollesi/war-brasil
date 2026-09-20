import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

test("profile appearance persists rich titles and mandatory profile backgrounds outside gameplay inventory", async () => {
  const migration = await source("src/lib/db/migrations/managed/050-profile-appearance-foundation.sql");

  assert.match(migration, /ADD COLUMN IF NOT EXISTS display_text/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS font_key/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS style_key/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS texture_ref/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS catalog\.profile_backgrounds/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS profile\.commander_backgrounds/);
  assert.match(migration, /profile\.background\.default/);
  assert.match(migration, /equipped_background_id/);
  assert.match(migration, /commanders_equipped_background_owned_fkey/);
  assert.match(migration, /commander_default_background_before_insert/);
  assert.match(migration, /AS \$body\$/);
  assert.doesNotMatch(migration, /LANGUAGE plpgsql\s+AS \$\s*$/m);
  assert.doesNotMatch(migration, /INSERT INTO inventory\.cosmetics[\s\S]*profile\.background/);
  assert.doesNotMatch(migration, /game\.player_cosmetic_loadouts/);
});

test("appearance API derives ownership server-side and never accepts arbitrary CSS", async () => {
  const route = await source("src/app/api/profile/appearance/route.ts");
  const service = await source("src/lib/server/profile/profile-appearance-service.ts");
  const contract = await source("src/lib/profile/profile-appearance-contract.ts");

  assert.match(route, /getAuthenticatedSession\(request\)/);
  assert.match(route, /requireProfileMutationActor\(request\)/);
  assert.match(service, /ownsActiveCommanderTitle/);
  assert.match(service, /ownsActiveProfileBackground/);
  assert.match(service, /PROFILE_BACKGROUND_REQUIRED/);
  assert.match(contract, /fontKey/);
  assert.match(contract, /styleKey/);
  assert.match(contract, /textureRef/);
  assert.doesNotMatch(service, /cssText|innerHTML|style\s*:/);
});

test("public profile projection exposes only equipped appearance and gameplay cosmetics", async () => {
  const snapshot = await source("src/lib/server/profile/public-profile-snapshot-service.ts");
  const repository = await source("src/lib/server/economy/economy-repository.ts");

  assert.match(snapshot, /getPublicProfileAppearance/);
  assert.match(snapshot, /listEquippedProfileCosmetics/);
  assert.match(snapshot, /diceAttack/);
  assert.match(snapshot, /diceDefense/);
  assert.match(snapshot, /diceNeutral/);
  assert.match(snapshot, /territorySkin/);
  assert.match(
    repository,
    /slot IN \('dice_attack','dice_defense','dice_neutral','territory_skin'\)/,
  );
});

test("profile backgrounds can reuse managed collection background assets", async () => {
  const migration = await source(
    "src/lib/db/migrations/managed/054-profile-background-shared-assets.sql",
  );
  const storage = await source(
    "src/lib/server/profile/profile-appearance-asset-storage.ts",
  );

  assert.match(migration, /store\/collections\//);
  assert.match(migration, /profile\.background\.cosmic-night/);
  assert.match(migration, /store\/collections\/viking\/background\.webp/);
  assert.match(migration, /store\/collections\/ceu-noturno\/background\.webp/);

  assert.match(storage, /SHARED_COLLECTION_BACKGROUND_KEY_PATTERN/);
  assert.match(storage, /collectionAssetDeliveryPath\(key\)/);
  assert.match(storage, /resolveCollectionAssetReadUrl\(key, options\)/);
});
