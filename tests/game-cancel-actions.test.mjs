import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const combatSource = readFileSync(
  "src/lib/server/game-combat-command-service.ts",
  "utf8",
);
const cancelRouteSource = readFileSync(
  "src/app/api/games/[roomId]/attack/cancel/route.ts",
  "utf8",
);
const battleOverlaySource = readFileSync(
  "src/components/battle-overlay.tsx",
  "utf8",
);
const turnPanelSource = readFileSync(
  "src/components/game-turn-panel.tsx",
  "utf8",
);

test("attack cancellation is server-authoritative and only allowed before the first roll", () => {
  assert.match(combatSource, /export async function cancelBattleCommand/);
  assert.match(combatSource, /assertAttackTurn\(room, player\)/);
  assert.match(combatSource, /battle\.attackerPlayerId !== player\.id/);
  assert.match(combatSource, /battle\.stage !== "awaiting_attacker_roll"/);
  assert.match(combatSource, /battle\.attacker\.length > 0/);
  assert.match(combatSource, /battle\.defender\.length > 0/);
  assert.match(combatSource, /await saveBattle\(client, room, null\)/);
});

test("attack cancel route uses the versioned command boundary", () => {
  assert.match(cancelRouteSource, /cancelBattleCommand/);
  assert.match(cancelRouteSource, /GAME_REVISION_HEADER/);
  assert.match(cancelRouteSource, /operation: "cancel_attack"/);
});

test("battle modal shows a small cancel action only to the attacker before rolling", () => {
  assert.match(
    battleOverlaySource,
    /const canCancelAttack =[\s\S]*?battle\.stage === "awaiting_attacker_roll"[\s\S]*?meId === battle\.attackerPlayerId/,
  );
  assert.match(battleOverlaySource, /"attack\/cancel"/);
  assert.match(battleOverlaySource, /Cancelar ataque/);
  assert.match(battleOverlaySource, /disabled=\{rollingSide !== null \|\| cancelling\}/);
});

test("maneuver quantity selection remains locally cancellable without sending a maneuver", () => {
  assert.match(
    turnPanelSource,
    /localDialog\?\.kind === "maneuver"[\s\S]*?<QuantityDialog[\s\S]*?onCancel=\{interaction\.clearDialog\}/,
  );
  assert.match(
    turnPanelSource,
    /\{onCancel \? \([\s\S]*?onClick=\{onCancel\}[\s\S]*?>[\s\S]*?Cancelar/,
  );
});

test("mandatory conquest troop transfer remains non-cancellable", () => {
  const conquestBlock = turnPanelSource.match(
    /\{isTurn && pendingConquest[\s\S]*?<QuantityDialog[\s\S]*?\/>/,
  )?.[0];
  assert.ok(conquestBlock);
  assert.doesNotMatch(conquestBlock, /onCancel=/);
});
