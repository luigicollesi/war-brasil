import assert from "node:assert/strict";
import test from "node:test";
import { deriveMapFocusTerritoryIds } from "../.test-build/game-map-focus.js";

const normalTarget = (territoryId) => ({
  territoryId,
  kind: "normal",
  selectable: true,
});

const attackBarrierTarget = (territoryId) => ({
  territoryId,
  kind: "barrier-attack",
  selectable: false,
  barrierName: "Serra",
  minimumTroops: 4,
});

const maneuverBarrierTarget = (territoryId) => ({
  territoryId,
  kind: "barrier-maneuver",
  selectable: false,
  barrierName: "Rio",
  troopLoss: 1,
  minimumTroops: 2,
});

test("reinforcement focuses only the selected territory", () => {
  assert.deepEqual(
    deriveMapFocusTerritoryIds({
      phase: "reinforcement",
      selectedTerritoryId: 18,
      targetHints: [],
      arrow: null,
    }),
    [18],
  );
});

test("attack focuses the source and every target including blocked barriers", () => {
  assert.deepEqual(
    deriveMapFocusTerritoryIds({
      phase: "attack",
      selectedTerritoryId: 18,
      targetHints: [normalTarget(23), attackBarrierTarget(17), normalTarget(19)],
      arrow: null,
    }),
    [17, 18, 19, 23],
  );
});

test("maneuver focuses the destination group without forcing the source into bounds", () => {
  assert.deepEqual(
    deriveMapFocusTerritoryIds({
      phase: "maneuver",
      selectedTerritoryId: 18,
      targetHints: [normalTarget(37), maneuverBarrierTarget(13), normalTarget(7)],
      arrow: null,
    }),
    [7, 13, 37],
  );
});

test("maneuver falls back to the selected source when there are no destinations", () => {
  assert.deepEqual(
    deriveMapFocusTerritoryIds({
      phase: "maneuver",
      selectedTerritoryId: 18,
      targetHints: [],
      arrow: null,
    }),
    [18],
  );
});

test("an active arrow always focuses its two endpoints", () => {
  assert.deepEqual(
    deriveMapFocusTerritoryIds({
      phase: "maneuver",
      selectedTerritoryId: 18,
      targetHints: [normalTarget(7), normalTarget(13)],
      arrow: { fromTerritoryId: 18, toTerritoryId: 37 },
    }),
    [18, 37],
  );
});

test("no selection and no arrow leaves the full map unfocused", () => {
  assert.deepEqual(
    deriveMapFocusTerritoryIds({
      phase: "attack",
      selectedTerritoryId: null,
      targetHints: [],
      arrow: null,
    }),
    [],
  );
});
