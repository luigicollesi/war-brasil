import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  deriveInitialTerritoryBoardPresentation,
  nextInitialTerritoryPresentationWakeAt,
} from "../.test-build/client/map/board-presentation.js";
import {
  insetPolygonPath,
  safeInsetPolygonPath,
} from "../.test-build/client/map/territory-hit-geometry.js";

const START = "2026-09-06T12:00:00.000Z";
const START_MS = Date.parse(START);
const MAP_SVG = readFileSync("public/mapa-war-brasil-25d.svg", "utf8");

test("hit geometry erodes a polygon instead of relying on masked visual pixels", () => {
  assert.equal(
    insetPolygonPath("M 0 0 L 10 0 L 10 10 L 0 10 Z", 1),
    "M 1 1 L 9 1 L 9 9 L 1 9 Z",
  );
  assert.equal(
    safeInsetPolygonPath("M 0 0 L 10 0 L 10 10 L 0 10 Z", 1),
    "M 1 1 L 9 1 L 9 9 L 1 9 Z",
  );
});

test("hit geometry supports relative M/L polygons used by generated assets", () => {
  assert.equal(
    insetPolygonPath("m 0 0 l 10 0 l 0 10 l -10 0 z", 1),
    "M 1 1 L 9 1 L 9 9 L 1 9 Z",
  );
});

test("unsafe self-intersecting hit geometry is rejected", () => {
  assert.equal(
    safeInsetPolygonPath("M 0 0 L 10 10 L 0 10 L 10 0 Z", 1),
    null,
  );
});

test("asset preserves the 42 canonical face ids and four depth layers", () => {
  const faceIds = [
    ...MAP_SVG.matchAll(
      /<path(?=[^>]*data-id="(\d+)")(?=[^>]*data-layer="face")[^>]*>/g,
    ),
  ].map((match) => Number(match[1]));
  const depthEntries = [
    ...MAP_SVG.matchAll(
      /<path(?=[^>]*data-territory-id="(\d+)")(?=[^>]*data-layer="depth-([1-4])")[^>]*>/g,
    ),
  ].map((match) => [Number(match[1]), Number(match[2])]);

  assert.equal(faceIds.length, 42);
  assert.deepEqual(
    [...new Set(faceIds)].sort((a, b) => a - b),
    Array.from({ length: 42 }, (_, index) => index + 1),
  );
  assert.equal(depthEntries.length, 42 * 4);

  for (let territoryId = 1; territoryId <= 42; territoryId += 1) {
    const layers = depthEntries
      .filter(([id]) => id === territoryId)
      .map(([, layer]) => layer)
      .sort((a, b) => a - b);
    assert.deepEqual(layers, [1, 2, 3, 4], `territory ${territoryId}`);
  }

  assert.match(MAP_SVG, /viewBox="0 0 1254 1254"/);
  assert.match(MAP_SVG, /data-top-inset="4\.0"/);
  assert.match(MAP_SVG, /data-body-inset="1\.05"/);
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
