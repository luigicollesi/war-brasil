import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const migration = read(
  "src/lib/db/migrations/managed/079-dice-pip-cosmetic-set-style.sql",
);
const contract = read("src/lib/economy/economy-contract.ts");
const repository = read("src/lib/server/economy/economy-repository.ts");
const service = read("src/lib/server/economy/economy-service.ts");
const showcase = read("src/lib/economy/store-showcase.ts");
const gameContract = read("src/lib/shared/game-contract.ts");
const gameCosmetics = read("src/lib/server/game-cosmetic-loadout-service.ts");
const sharing = read("src/lib/shared/game-snapshot-sharing.ts");
const textureTypes = read("src/lib/client/dice/types.ts");
const assets = read("src/lib/client/dice/dice-assets-manager.ts");
const texture = read("src/lib/client/dice/textures/create-face-texture.ts");
const pipLayout = read("src/lib/client/dice/pip-layout.ts");
const pipPresentation = read("src/lib/client/dice/pip-presentation.ts");
const showcaseModel = read(
  "src/components/profile/v4/store-showcase/dice-showcase-model.tsx",
);
const battle = read("src/components/battle-overlay.tsx");
const fullscreen = read(
  "src/components/dice-3d/fullscreen-dice-cinematic.tsx",
);
const staticDice = read("src/components/battle-static-dice-results.tsx");
const gameClient = read("src/components/game-client-v2.tsx");

test("migration keeps pip style on cosmetic_sets and removes collection ownership", () => {
  assert.match(
    migration,
    /ALTER TABLE catalog\.cosmetic_sets[\s\S]*dice_pip_dark[\s\S]*dice_pip_compact/,
  );
  assert.match(
    migration,
    /ALTER TABLE catalog\.collections[\s\S]*DROP COLUMN IF EXISTS dice_pip_dark[\s\S]*DROP COLUMN IF EXISTS dice_pip_compact/,
  );
  assert.match(
    migration,
    /ALTER TABLE game\.player_cosmetic_loadouts[\s\S]*dice_pip_dark[\s\S]*dice_pip_compact/,
  );
  assert.match(
    migration,
    /UNIQUE \(cosmetic_id\)/,
  );
  assert.match(migration, /'set\.cosmic-night','set\.black-dragon'/);
  assert.match(migration, /dice_pip_compact=FALSE/);
});

test("economy exposes canonical set flags without adding them to commercial collections", () => {
  assert.match(contract, /export type CosmeticSet[\s\S]*dicePipDark: boolean[\s\S]*dicePipCompact: boolean/);
  assert.match(repository, /cosmetic_set\.dice_pip_dark AS set_dice_pip_dark/);
  assert.match(repository, /cosmetic_set\.dice_pip_compact AS set_dice_pip_compact/);
  assert.match(service, /dicePipDark: row\.set_dice_pip_dark/);
  assert.match(service, /dicePipCompact: row\.set_dice_pip_compact/);

  const collectionStart = contract.indexOf("export type StorefrontCollection");
  const collectionEnd = contract.indexOf("export type EconomyStorefrontSnapshot");
  const collectionContract = contract.slice(collectionStart, collectionEnd);
  assert.doesNotMatch(collectionContract, /dicePipDark|dicePipCompact/);
});

test("store resolves each dice presentation from cosmetic set membership", () => {
  assert.match(showcase, /function dicePresentationForItem/);
  assert.match(showcase, /storefront\.sets\.find/);
  assert.match(showcase, /candidate\.id === item\.id/);
  assert.match(showcase, /dicePipDark: cosmeticSet\?\.dicePipDark \?\? false/);
  assert.match(showcase, /dicePipCompact: cosmeticSet\?\.dicePipCompact \?\? false/);
  assert.match(showcaseModel, /storeDicePipColor\(dicePipDark\)/);
  assert.match(showcaseModel, /pipCompact:\s*dicePipCompact/);
});

test("match start copies set flags into frozen game snapshot and runtime does not rejoin catalog", () => {
  assert.match(gameContract, /dicePipDark: boolean/);
  assert.match(gameContract, /dicePipCompact: boolean/);
  assert.match(
    gameCosmetics,
    /LEFT JOIN catalog\.cosmetic_set_items membership[\s\S]*LEFT JOIN catalog\.cosmetic_sets cosmetic_set/,
  );
  assert.match(
    gameCosmetics,
    /body_color,body_highlight_color,dice_pip_dark,dice_pip_compact,captured_at/,
  );

  const runtime = gameCosmetics.slice(
    gameCosmetics.indexOf("export async function loadRoomPlayerCosmetics"),
  );
  assert.match(runtime, /snapshot\.dice_pip_dark/);
  assert.match(runtime, /snapshot\.dice_pip_compact/);
  assert.doesNotMatch(runtime, /catalog\.|profile\.|inventory\./);

  assert.match(sharing, /left\.dicePipDark === right\.dicePipDark/);
  assert.match(sharing, /left\.dicePipCompact === right\.dicePipCompact/);
});

test("2D and 3D dice share compact/spread semantics and cache identity", () => {
  assert.match(pipLayout, /export type DicePipSpacing = "spread" \| "compact"/);
  assert.match(pipLayout, /export function dicePipLayout/);
  assert.match(textureTypes, /pipCompact\?: boolean/);
  assert.match(assets, /options\.pipCompact \? "compact" : "spread"/);
  assert.match(texture, /dicePipLayout\([\s\S]*pipCompact \? "compact" : "spread"/);
});

test("dark-surface color policy stays centralized and set-driven", () => {
  assert.match(pipPresentation, /DARK_SURFACE_PIP_COLOR = "#ffffff"/);
  assert.match(pipPresentation, /GAMEPLAY_DARK_SURFACE_LIGHTEN_RATIO/);
  assert.match(pipPresentation, /export function storeDicePipColor/);
  assert.match(pipPresentation, /export function gameplayDicePipColor/);
  assert.doesNotMatch(showcaseModel, /cosmic-night|black-dragon/i);
  assert.doesNotMatch(fullscreen, /cosmic-night|black-dragon/i);
});

test("battle and order-roll paths consume the frozen flags", () => {
  assert.match(battle, /diceAttack\.dicePipDark/);
  assert.match(battle, /diceAttack\.dicePipCompact/);
  assert.match(battle, /diceDefense\.dicePipDark/);
  assert.match(battle, /diceDefense\.dicePipCompact/);
  assert.match(fullscreen, /gameplayDicePipColor\(color, dicePipDark\)/);
  assert.match(fullscreen, /pipCompact:\s*dicePipCompact/);
  assert.match(staticDice, /gameplayDicePipColor\(attackerColor, attackDicePipDark\)/);
  assert.match(staticDice, /gameplayDicePipColor\(defenderColor, defenseDicePipDark\)/);
  assert.match(gameClient, /diceNeutral\.dicePipDark/);
  assert.match(gameClient, /diceNeutral\.dicePipCompact/);
});
