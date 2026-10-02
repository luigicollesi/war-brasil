import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const migration = read(
  "src/lib/db/migrations/managed/084-dice-body-color-from-set-darkness.sql",
);
const bodyPresentation = read("src/lib/shared/dice-body-presentation.ts");
const gameCosmetics = read("src/lib/server/game-cosmetic-loadout-service.ts");
const economyService = read("src/lib/server/economy/economy-service.ts");
const publicProfile = read(
  "src/lib/server/profile/public-profile-snapshot-service.ts",
);
const showcase = read("src/lib/economy/store-showcase.ts");
const metadataRepository = read(
  "src/lib/server/assets/dice-asset-metadata-repository.ts",
);

test("migration removes persisted body colors from every dice row and snapshot", () => {
  assert.match(
    migration,
    /UPDATE catalog\.cosmetics[\s\S]*body_color=NULL[\s\S]*body_highlight_color=NULL[\s\S]*slot IN \('dice_attack','dice_defense','dice_neutral'\)/,
  );
  assert.match(
    migration,
    /UPDATE game\.player_cosmetic_loadouts[\s\S]*body_color=NULL[\s\S]*body_highlight_color=NULL[\s\S]*slot IN \('dice_attack','dice_defense','dice_neutral'\)/,
  );
  assert.match(migration, /cosmetics_dice_body_color_unused_check/);
  assert.match(
    migration,
    /player_cosmetic_loadouts_dice_body_color_unused_check/,
  );
});

test("slot defines canonical light color and dark flag only darkens that family", () => {
  assert.match(bodyPresentation, /dice_attack: "#BF4D4D"/);
  assert.match(bodyPresentation, /dice_defense: "#3984C6"/);
  assert.match(bodyPresentation, /dice_neutral: "#3F8B68"/);
  assert.match(bodyPresentation, /DARK_BODY_CHANNEL_RATIO = 0\.58/);
  assert.match(
    bodyPresentation,
    /return dark \? DARK_DICE_BODY_COLOR\[slot\] : LIGHT_DICE_BODY_COLOR\[slot\]/,
  );
});

test("game, profile and store derive body color from slot plus dicePipDark", () => {
  assert.match(
    gameCosmetics,
    /bodyColor: diceBodyColorForSlot\(row\.slot, row\.dice_pip_dark\)/,
  );
  assert.match(
    gameCosmetics,
    /NULL::varchar\(7\) AS body_color,[\s\S]*NULL::varchar\(7\) AS body_highlight_color/,
  );
  assert.match(
    publicProfile,
    /bodyColor: diceBodyColorForSlot\(row\.slot, row\.dice_pip_dark\)/,
  );
  assert.match(
    showcase,
    /bodyColor: diceBodyColorForSlot\(item\.slot, presentation\.dicePipDark\)/,
  );
  assert.match(economyService, /bodyColor: null,[\s\S]*bodyHighlightColor: null/);
});

test("legacy dice metadata derives presentation instead of reading body_color", () => {
  assert.match(metadataRepository, /cosmetic_set\.dice_pip_dark/);
  assert.match(metadataRepository, /diceBodyColorForSlot/);
  assert.doesNotMatch(metadataRepository, /SELECT body_color/);
});
