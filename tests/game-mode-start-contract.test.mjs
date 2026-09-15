import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const start = readFileSync("src/lib/server/start-game-service.ts", "utf8");
const dice = readFileSync("src/lib/server/game-dice-balance-service.ts", "utf8");

test("start cria objetivos somente quando o snapshot do ruleset é objective", () => {
  assert.match(start, /const matchContext = await initializeDiceBalanceForGame/);
  assert.match(start, /if \(matchContext\.ruleset === "objective"\)/);
  assert.match(start, /await createObjectives\(client, roomId, players\)/);
});

test("match congela ruleset e flag de sorte junto do perfil efetivo", () => {
  assert.match(dice, /ruleset_snapshot/);
  assert.match(dice, /balanced_dice_enabled_snapshot/);
  assert.match(dice, /room\.ruleset/);
  assert.match(dice, /room\.balanced_dice_enabled/);
});

test("sorte desligada resolve perfil uniforme sem aceitar profile id do browser", () => {
  assert.match(dice, /UNIFORM_DICE_PROFILE_ID/);
  assert.match(dice, /resolveProfileForNewMatch\(client, room\.balanced_dice_enabled\)/);
  assert.match(dice, /loadCatalogProfile\(client, UNIFORM_DICE_PROFILE_ID\)/);
});
