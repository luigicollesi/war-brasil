import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveInitialTerritoryBoardPresentation,
  nextInitialTerritoryPresentationWakeAt,
} from "../.test-build/client/map/board-presentation.js";
import { insetPolygonPath } from "../.test-build/client/map/territory-hit-geometry.js";

const START = "2026-09-06T12:00:00.000Z";
const START_MS = Date.parse(START);

test("hit geometry erodes a polygon instead of relying on masked visual pixels", () => {
  assert.equal(
    insetPolygonPath("M 0 0 L 10 0 L 10 10 L 0 10 Z", 1),
    "M 1 1 L 9 1 L 9 9 L 1 9 Z",
  );
});

test("hit geometry supports relative M/L polygons used by generated assets", () => {
  assert.equal(
    insetPolygonPath("m 0 0 l 10 0 l 0 10 l -10 0 z", 1),
    "M 1 1 L 9 1 L 9 9 L 1 9 Z",
  );
});

test("opening presentation is discrete and reveals only territories whose boundary passed", () => {
  const beforeStart = deriveInitialTerritoryBoardPresentation({
    territoryIds: [7, 3, 12],
    startedAt: START,
    nowMs: START_MS - 100,
    highlightPlayerId: "p1",
  });
  assert.equal(beforeStart.mode, "initial-territory-draw");
  assert.equal(beforeStart.titleVisible, true);
  assert.equal(beforeStart.revealedTerritoryIds.size, 0);

  const afterTwoSteps = deriveInitialTerritoryBoardPresentation({
    territoryIds: [7, 3, 12],
    startedAt: START,
    nowMs: START_MS + 400,
    highlightPlayerId: "p1",
  });
  assert.deepEqual([...afterTwoSteps.revealedTerritoryIds], [7, 3]);
  assert.equal(afterTwoSteps.highlightOn, false);
});

test("opening highlight starts only after the final reveal and advances on 500ms boundaries", () => {
  const firstHighlight = deriveInitialTerritoryBoardPresentation({
    territoryIds: [7, 3, 12],
    startedAt: START,
    nowMs: START_MS + 600,
    highlightPlayerId: "p1",
  });
  assert.equal(firstHighlight.highlightOn, true);

  const secondHighlightStep = deriveInitialTerritoryBoardPresentation({
    territoryIds: [7, 3, 12],
    startedAt: START,
    nowMs: START_MS + 1_100,
    highlightPlayerId: "p1",
  });
  assert.equal(secondHighlightStep.highlightOn, false);
});

test("presentation scheduler wakes only on the next semantic boundary", () => {
  assert.equal(
    nextInitialTerritoryPresentationWakeAt({
      territoryIds: [7, 3, 12],
      startedAt: START,
      nowMs: START_MS - 1_000,
    }),
    START_MS,
  );
  assert.equal(
    nextInitialTerritoryPresentationWakeAt({
      territoryIds: [7, 3, 12],
      startedAt: START,
      nowMs: START_MS + 250,
    }),
    START_MS + 400,
  );
  assert.equal(
    nextInitialTerritoryPresentationWakeAt({
      territoryIds: [7, 3, 12],
      startedAt: START,
      nowMs: START_MS + 600,
    }),
    START_MS + 1_100,
  );
});
